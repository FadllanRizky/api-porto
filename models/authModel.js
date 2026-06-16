const pool = require('../config/db');

const User = {
  findByEmail: async (email) => {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    return result.rows[0];
  },

  findById: async (id) => {
    const result = await pool.query(
      'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  create: async (email, password, fullName) => {
    try {
      const query = `
        INSERT INTO users (email, password, full_name) 
        VALUES ($1, $2, $3) 
        RETURNING id, email, full_name, role, created_at
      `;
      const result = await pool.query(query, [email, password, fullName]);
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        throw new Error('Email sudah terdaftar!');
      }
      throw err;
    }
  },

  update: async (id, fullName) => {
    const query = `
      UPDATE users 
      SET full_name = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING id, email, full_name, role
    `;
    const result = await pool.query(query, [fullName, id]);
    return result.rows[0];
  },

  delete: async (id) => {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return { message: "User deleted" };
  }
};

module.exports = User;