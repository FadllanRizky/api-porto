import { supabase } from '../config/db.js';

const chatController = {
  
  // 👑 1. Ambil daftar user yang memiliki riwayat chat (Untuk Sidebar Admin)
  getChatUsers: async (req, res) => {
    try {
      const { data: chatMessages, error: chatError } = await supabase
        .from('chat_messages')
        .select(`
          customer_id,
          users!customer_id (id, full_name, email)
        `);

      if (chatError) {
        console.error("🚨 Supabase Error di getChatUsers:", chatError);
        return res.status(400).json({ error: chatError.message });
      }

      const uniqueUsers = [];
      const seenIds = new Set();

      chatMessages?.forEach((item) => {
        const targetId = item.users?.id || item.customer_id;

        if (targetId && !seenIds.has(targetId)) {
          seenIds.add(targetId);
          uniqueUsers.push({
            id: targetId,
            full_name: item.users?.full_name || `Pelanggan Mbur (${targetId.substring(0, 6)})`,
            email: item.users?.email || 'Tanpa Akun Terhubung'
          });
        }
      });

      return res.status(200).json(uniqueUsers);
    } catch (error) {
      console.error("🚨 Crash Fatal di getChatUsers:", error);
      return res.status(500).json({ error: "Server error internal, bos!" });
    }
  },

  // 💬 2. Ambil semua riwayat chat (SINKRON UNTUK USER & ADMIN)
  getChats: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Token tidak valid atau belum login, bos!" });
      }

      const { role, id: userId } = req.user; 
      let customerId = userId;

      if (role === 'admin') {
        // 🔥 FIX: Toleransi ganda! Bisa membaca ?target_user= atau ?target_user_id= dari frontend
        customerId = req.query.target_user || req.query.target_user_id;
        
        if (!customerId) {
          console.warn("⚠️ Admin minta chat tapi query target_user_id kosong!");
          return res.status(400).json({ error: "ID target_user wajib dikirim di query string, bos!" });
        }
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("🚨 Supabase Error di getChats:", error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json(data);
    } catch (error) {
      console.error("🚨 Crash Fatal di getChats:", error);
      return res.status(500).json({ error: "Server error internal, bos!" });
    }
  },

  // ✉️ 3. Kirim Pesan Baru (Mendukung Payload dinamis dari Customer maupun Admin)
  sendMessage: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Token lu ghaib atau belom login, boskuh!" });
      }

      const { message, target_user_id, target_user } = req.body;
      const { id: sender_id, role: sender_role } = req.user; 

      const finalTargetId = target_user_id || target_user;
      const customer_id = sender_role === 'admin' ? finalTargetId : sender_id;

      if (!customer_id || !message) {
        return res.status(400).json({ error: "Isian data chat atau room target (target_user_id) tidak lengkap boskuh!" });
      }

      // 🔥 Adaptasi FK: sender_id harus mengacu ke admins(id). Cari admin ID jika customer yang kirim
      let resolvedSenderId = sender_id;
      if (sender_role !== 'admin') {
        const { data: adminRef } = await supabase
          .from('admins')
          .select('id')
          .limit(1)
          .single();
        if (adminRef?.id) {
          resolvedSenderId = adminRef.id;
        }
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([
          {
            customer_id,
            sender_id: resolvedSenderId,
            sender_role,
            message: message.trim()
          }
        ])
        .select();

      if (error) {
        console.error("🚨 Supabase Menolak Insert Chat!", error);
        return res.status(400).json({ 
          error: "Supabase menolak kiriman pesan, bos!", 
          reason: error.message 
        });
      }

      return res.status(201).json(data[0]);
    } catch (error) {
      console.error("🚨 Crash Fatal di sendMessage Controller:", error);
      return res.status(500).json({ error: error.message });
    }
  }
};

export default chatController;