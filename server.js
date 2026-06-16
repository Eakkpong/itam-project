const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// สั่งให้เซิร์ฟเวอร์ส่งหน้าเว็บจากโฟลเดอร์ public อัตโนมัติ
app.use(express.static(path.join(__dirname, 'public')));

// การเชื่อมต่อฐานข้อมูล รองรับทั้งแบบเครื่องตัวเอง และแบบคลาวด์ออนไลน์ (DATABASE_URL)
const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
const pool = new Pool({
    connectionString: isProduction ? process.env.DATABASE_URL : undefined,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    // ถ้าไม่ใช่โปรดักชั่น ให้ใช้ค่าจาก .env ปกติ
    user: isProduction ? undefined : process.env.DB_USER,
    password: isProduction ? undefined : process.env.DB_PASSWORD,
    host: isProduction ? undefined : process.env.DB_HOST,
    database: isProduction ? undefined : process.env.DB_DATABASE,
    port: isProduction ? undefined : process.env.DB_PORT,
});

// Endpoint 1: ดึงตัวเลข KPIs ด้านบน
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_assets,
                COALESCE(SUM(purchase_price), 0) as total_value,
                COUNT(CASE WHEN notes LIKE '%(หมดประกัน)%' THEN 1 END) as expired_warranty
            FROM equipments;
        `;
        const result = await pool.query(query);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database Error" });
    }
});

// Endpoint 2: ดึงข้อมูลสรุปทำกราฟ
app.get('/api/dashboard/charts', async (req, res) => {
    try {
        const catQuery = `SELECT category, COUNT(*) as count FROM equipments GROUP BY category;`;
        const catResult = await pool.query(catQuery);
        res.json({ categories: catResult.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database Error" });
    }
});

// Endpoint 3: รายการครุภัณฑ์ทั้งหมด + ระบบค้นหา
app.get('/api/equipments', async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT e.*, p.first_name || ' ' || p.last_name as owner_name 
            FROM equipments e
            LEFT JOIN personnel p ON e.owner_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (search) {
            query += ` AND (e.asset_code ILIKE $1 OR e.category ILIKE $1 OR e.location ILIKE $1 OR p.first_name ILIKE $1)`;
            params.push(`%${search}%`);
        }
        query += ` ORDER BY e.asset_code ASC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database Error" });
    }
});

// ถ้าผู้ใช้พิมพ์ URL อื่นๆ ให้ส่งหน้าแรกไปให้เสมอ (Single Page Application)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 ITAM Server is running on port ${port}`);
});