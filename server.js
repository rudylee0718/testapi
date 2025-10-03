const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
// 載入 dotenv 套件，它會從 .env 檔案載入環境變數
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;



// --- 全域資料定義 ---
// 定義 testapi.process_record 的所有欄位名稱，用於 POST API
// 這是為了確保插入時的欄位順序與資料表結構完全匹配
const PROCESS_RECORD_COLUMNS = [
    'uid', 'cust_id', 'qo_no', 'qo_date', 'ship_date', 'set_location', 'window_no', 'color_no', 'product', 'fabric', 
    'process', 'width', 'height', 'sewing_add', 'open_style', 'process_times', 'joining_fabric', 'symm_pattern', 
    'petal_qty', 'v_petal_length', 'h_petal_length', 'frames', 'least_qty', 'cutain_hem', 'label', 'band_type', 
    'iron', 'neck_style', 'sketch', 'hook_type', 'head_style', 'last_qty', 'urgent', 'pcs', 'qty_che', 'qty_yd', 
    'width_left', 'width_right', 'height_left', 'height_right', 'large_and_small', 'sew_together', 'st_group', 
    'comment', 'crew_cut', 'cust_name', 'unit', 'o_width_left', 'o_width_right', 'o_height', 'o_height_left', 
    'o_height_right', 'selfde_frames', 'band_needed', 'hook_qty', 'hook_length', 'lead', 'keep_pattern', 'process_qty', 
    'process_unit', 'join_fabric_qty_yd', 'join_fabric_qty_che', 'ship_type', 'shipping_locate', 'erp_custid', 
    'case_name', 'shared_fabric', 'shared_group', 'roman_track', 'process_frame_qty', 'band_qty', 'make_hole', 
    'hole_qty', 'velcro', 'velcro_qty', 'special_sew', 'hidden_sew', 'mark_line', 'side_loop_fasteners', 
    'band_with_velcro', 'band_on_side', 'iron_hole_qty', 'itemno', 'real_frame_width'
];
// --- 資料庫設定與初始化 ---

// 檢查必要的環境變數
if (!process.env.DB_USER || !process.env.DB_HOST || !process.env.DB_DATABASE || !process.env.DB_PASSWORD) {
    console.error("錯誤: 缺少必要的資料庫環境變數 (DB_USER, DB_HOST, DB_DATABASE, DB_PASSWORD)。請檢查您的 .env 檔案。");
    // 缺少必要設定時退出
    process.exit(1);
}

// 從環境變數中讀取資料庫設定
const dbConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    // 新增 SSL 設定，解決 ECONNRESET 和 SSL/TLS required 錯誤
    // rejectUnauthorized: false 在開發時很有用，因為它會接受自簽章憑證
    ssl: {
        rejectUnauthorized: false,
    },
};

const pool = new Pool(dbConfig);

// 測試資料庫連線
async function testDbConnection() {
    let client;
    try {
        console.log('嘗試連線到資料庫...');
        client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        console.log('✅ 資料庫連線成功！');
        return true;
    } catch (err) {
        // 在連線失敗時，只記錄錯誤訊息，而不是整個錯誤物件，更清晰
        console.error('❌ 資料庫連線失敗！請檢查您的 DB 環境變數和連線設定。', err.message);
        // 確保在發生錯誤時釋放連線
        if (client) {
            client.release();
        }
        return false;
    }
}

// 允許解析 JSON 格式的請求主體 (用於 POST/PUT 請求)
app.use(express.json());
// 使用 CORS 中介軟體，允許來自不同來源的請求
app.use(cors());

// 定義 API 端點來提供 UI 資料
app.get('/api/ui-data', async (req, res) => {
    try {

        // 取得 product 參數，如果沒有則使用預設值 'general'
        const product = req.query.product || 'general';
        // 同時執行所有資料庫查詢，提高效率
        // const [uiElementsResult, optionsDataResult, uiChangedResult] = await Promise.all([
        //     pool.query('SELECT * FROM testapi.ui_elements ORDER BY seq_id ASC'),
        //     pool.query('SELECT * FROM testapi.options_data ORDER BY option_id ASC'),
        //     pool.query('SELECT * FROM testapi.ui_changed ORDER BY change_id ASC')
        // ]);
        // 根據 product 參數篩選 ui_elements 和 ui_changed
        const [uiElementsResult, optionsDataResult, uiChangedResult] = await Promise.all([
            pool.query('SELECT * FROM testapi.ui_elements WHERE product = $1 OR product = \'*\' ORDER BY seq_id ASC', [product]),
            pool.query('SELECT * FROM testapi.options_data ORDER BY option_id ASC'),
            pool.query('SELECT * FROM testapi.ui_changed ORDER BY change_id ASC')
        ]);        
        // 處理 ui_elements 資料
        const uiDataTable = uiElementsResult.rows.map(row => {
            const item = {
                element_id: row.element_id,
                seq_id: row.seq_id,
                element_type: row.element_type
            };
            
            if (row.label) item.label = row.label;
            // 新增邏輯：將 parent_id 欄位加入回傳的物件
            if (row.parent_id) item.parent_id = row.parent_id;
            if (row.initial_value) {
                if (row.initial_value === 'TRUE') {
                    item.initialValue = true;
                } else if (row.initial_value === 'FALSE') {
                    item.initialValue = false;
                } else {
                    item.initialValue = row.initial_value;
                }
            }
            if (row.options_key) item.options_key = row.options_key;
            if (row.properties) item.properties = row.properties;
            if (row.trigger_event) item.trigger_event = row.trigger_event;
            // 新增 product 欄位
            if (row.product) item.product = row.product;
            return item;
        });


        // 處理 options_data 資料，並將其組合成 Map
        const optionsData = optionsDataResult.rows;
        const optionsDataTable = optionsData.reduce((acc, current) => {
            let table = acc.find(item => item.key === current.option_key);
            if (!table) {
                table = {
                    key: current.option_key,
                    options: []
                };
                acc.push(table);
            }

            const option = {
                value: current.value,
                label: current.label,
            };
            // if (current.parent_value) {
            //     option.parent_value = current.parent_value;
            // }
            // 變更邏輯：將 parent_value 變更為 product
            if (current.product) {
                option.product = current.product;
            }            
            table.options.push(option);
            return acc;
        }, []);
        
        // 處理 ui_changed 資料
        const uiChangedTable = uiChangedResult.rows.map(row => {
            return {
                change_id: row.change_id,
                element_id: row.element_id,
                parent_value: row.parent_value,
                action_id: row.action_id,
                action_type: row.action_type
            };
        });

        const responseData = {
            uiDataTable: uiDataTable,
            optionsDataTable: optionsDataTable,
            uiChangedTable: uiChangedTable
        };

        // const responseData = {
        //     uiDataTable: uiDataTable,
        //     optionsDataTable: optionsDataTable,
        // };

        res.json(responseData);

    } catch (err) {
        console.error('資料庫查詢錯誤', err);
        res.status(500).json({ error: '內部伺服器錯誤' });
    }
});

// 新增 API 端點：處理新增紀錄到 testapi.process_record (POST)
app.post('/api/add-record', async (req, res) => {
    let client;
    const recordData = req.body; // 獲取從 Flutter 傳來的 JSON 資料

    // 1. 準備 SQL 查詢的參數陣列
    // 按照 PROCESS_RECORD_COLUMNS 的順序，從 recordData 中提取值
    // 如果欄位在 recordData 中不存在，則使用 null
    const values = PROCESS_RECORD_COLUMNS.map(col => recordData[col] === undefined ? null : recordData[col]);
    
    // 2. 建立 parameterized query 的 placeholder 字串 ($1, $2, ...)
    const placeholders = PROCESS_RECORD_COLUMNS.map((_, index) => `$${index + 1}`).join(', ');
    
    // 3. 建立完整的 SQL 語句
    const columns = PROCESS_RECORD_COLUMNS.join(', ');
    const sql = `INSERT INTO testapi.process_record (${columns}) VALUES (${placeholders})`;

    try {
        client = await pool.connect();
        
        // 執行插入操作
        const result = await client.query(sql, values);

        console.log('紀錄成功新增:', result.rowCount, '列');
        res.status(201).json({ 
            message: '紀錄成功新增', 
            // 返回關鍵識別資訊，方便前端確認
            qo_no: recordData.qo_no, 
            uid: recordData.uid 
        });

    } catch (err) {
        // 處理資料庫錯誤，例如資料型別不匹配或 PRIMARY KEY 衝突
        console.error('新增紀錄時發生錯誤', err.message);
        // 返回 400 Bad Request 或 500 Internal Server Error
        res.status(400).json({ 
            error: '新增紀錄失敗', 
            details: err.message,
            code: err.code // 返回 PostgreSQL 錯誤碼 (例如 23505 for unique_violation)
        });
    } finally {
        // 確保釋放連線
        if (client) {
            client.release();
        }
    }
});

// 啟動伺服器
async function startServer() {
    const isConnected = await testDbConnection();
    if (isConnected) {
        app.listen(port, () => {
            console.log(`🚀 伺服器正在 http://localhost:${port} 運作`);
        });
    } else {
        console.error('⚠️ 無法啟動伺服器，因為資料庫連線失敗。');
    }
}

startServer();

// app.listen(port, () => {
//     console.log(`伺服器正在 http://localhost:${port} 運作`);
// });
