const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// ตั้งค่า Middleware
app.use(cors());
app.use(express.json());

// สั่งให้เซิร์ฟเวอร์ส่งหน้าเว็บสแตติกจากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// ตรวจสอบว่าเป็นสภาพแวดล้อมจริง (Production) หรือในเครื่องตัวเอง (Development)
const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;

// ตั้งค่าการเชื่อมต่อตู้เซฟ PostgreSQL
const pool = new Pool({
    connectionString: isProduction ? process.env.DATABASE_URL : undefined,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    // หากทดสอบในเครื่องตัวเอง จะดึงค่าจาก .env
    user: isProduction ? undefined : process.env.DB_USER,
    password: isProduction ? undefined : process.env.DB_PASSWORD,
    host: isProduction ? undefined : process.env.DB_HOST,
    database: isProduction ? undefined : process.env.DB_DATABASE,
    port: isProduction ? undefined : process.env.DB_PORT,
});

// ตรวจสอบการเชื่อมต่อตู้เซฟเมื่อเปิดระบบ
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ ไม่สามารถเชื่อมต่อตู้เซฟฐานข้อมูลได้:', err.stack);
    } else {
        console.log('⚡ เชื่อมต่อตู้เซฟ PostgreSQL สำเร็จแล้ว!');
        release();
    }
});

// ==========================================
// 📊 API 1: สรุปข้อมูลตัวเลข KPIs บน Dashboard
// ==========================================
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*)::integer as total_assets,
                COALESCE(SUM(purchase_price), 0)::numeric as total_value,
                COUNT(CASE WHEN notes LIKE '%(หมดประกัน)%' THEN 1 END)::integer as expired_warranty
            FROM public.equipments;
        `;
        const result = await pool.query(query);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('API Error /stats:', err.message);
        res.status(500).json({ error: "ไม่สามารถดึงข้อมูลสถิติได้" });
    }
});

// ==========================================
// 📈 API 2: ดึงข้อมูลสรุปสัดส่วนอุปกรณ์ทำกราฟ
// ==========================================
app.get('/api/dashboard/charts', async (req, res) => {
    try {
        const query = `
            SELECT category, COUNT(*)::integer as count 
            FROM public.equipments 
            GROUP BY category;
        `;
        const result = await pool.query(query);
        res.json({ categories: result.rows });
    } catch (err) {
        console.error('API Error /charts:', err.message);
        res.status(500).json({ error: "ไม่สามารถดึงข้อมูลทำกราฟได้" });
    }
});

// ==========================================
// 📋 API 3: ทะเบียนครุภัณฑ์พร้อมระบบค้นหา Dynamic Search
// ==========================================
app.get('/api/equipments', async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT e.*, p.first_name || ' ' || p.last_name as owner_name 
            FROM public.equipments e
            LEFT JOIN public.personnel p ON e.owner_id = p.id
            WHERE 1=1
        `;
        const params = [];
        
        if (search) {
            query += ` AND (
                e.asset_code ILIKE $1 
                OR e.category ILIKE $1 
                OR e.brand ILIKE $1 
                OR e.model ILIKE $1 
                OR e.location ILIKE $1 
                OR p.first_name ILIKE $1 
                OR p.last_name ILIKE $1
            )`;
            params.push(`%${search}%`);
        }
        
        query += ` ORDER BY e.asset_code ASC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('API Error /equipments:', err.message);
        res.status(500).json({ error: "ไม่สามารถดึงข้อมูลทะเบียนพัสดุได้" });
    }
});

// หากผู้ใช้พิมพ์เส้นทางอื่น ให้ดีดกลับไปที่หน้าแรกเสมอ (SPA Web App Support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// เริ่มต้นรันบริการหลังบ้าน
app.listen(port, () => {
    console.log(`🚀 เซิร์ฟเวอร์ ITAM SMKCC รันออนไลน์แล้วที่พอร์ต ${port}`);
});
