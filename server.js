const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// เชื่อมต่อฐานข้อมูล PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// API ดึงสถิติ Dashboard
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*)::integer as total_assets,
                COALESCE(SUM(purchase_price), 0)::numeric as total_value,
                COUNT(CASE WHEN status = 'ส่งซ่อม' THEN 1 END)::integer as expired_warranty
            FROM public.equipments;
        `);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API ดึงรายการพัสดุ
app.get('/api/equipments', async (req, res) => {
    const { search } = req.query;
    let query = `SELECT * FROM public.equipments WHERE 1=1`;
    const params = [];
    if (search) {
        query += ` AND (asset_code ILIKE $1 OR brand ILIKE $1 OR location ILIKE $1)`;
        params.push(`%${search}%`);
    }
    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API เพิ่มข้อมูล
app.post('/api/equipments', async (req, res) => {
    try {
        const { asset_code, category, brand, model, location, status } = req.body;
        await pool.query(
            'INSERT INTO public.equipments (asset_code, category, brand, model, location, status) VALUES ($1, $2, $3, $4, $5, $6)',
            [asset_code, category, brand, model, location, status]
        );
        res.status(201).json({ message: 'Success' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API อัปเดตข้อมูล
app.put('/api/equipments/:asset_code', async (req, res) => {
    try {
        const { asset_code } = req.params;
        const { location, status, brand, model } = req.body;
        await pool.query(
            'UPDATE public.equipments SET location=$1, status=$2, brand=$3, model=$4 WHERE asset_code=$5',
            [location, status, brand, model, asset_code]
        );
        res.json({ message: 'Updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
