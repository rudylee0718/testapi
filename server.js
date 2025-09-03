// const express = require('express');
// const { Pool } = require('pg');
// const cors = require('cors');
// // 載入 dotenv 套件，它會從 .env 檔案載入環境變數
// require('dotenv').config();

// const app = express();
// const port = process.env.PORT || 3000;

// // 從環境變數中讀取資料庫設定
// const dbConfig = {
//     user: process.env.DB_USER,
//     host: process.env.DB_HOST,
//     database: process.env.DB_DATABASE,
//     password: process.env.DB_PASSWORD,
//     port: parseInt(process.env.DB_PORT || '5432'),
//     // 新增 SSL 設定，解決 ECONNRESET 和 SSL/TLS required 錯誤
//     // rejectUnauthorized: false 在開發時很有用，因為它會接受自簽章憑證
//     ssl: {
//         rejectUnauthorized: false,
//     },
// };

// const pool = new Pool(dbConfig);

// // 使用 CORS 中介軟體，允許來自不同來源的請求
// app.use(cors());

// // 定義 API 端點來提供 UI 資料
// app.get('/api/ui-data', async (req, res) => {
//     try {
//         // 同時執行兩個資料庫查詢，提高效率
//         // 注意：這裡的查詢已經更新，以包含 'testAPI' schema
//         const [uiElementsResult, optionsDataResult] = await Promise.all([
//             pool.query('SELECT * FROM testapi.ui_elements ORDER BY element_id ASC'),
//             pool.query('SELECT * FROM testapi.options_data ORDER BY option_id ASC')
//         ]);

//         // 處理 ui_elements 資料
//         const uiDataTable = uiElementsResult.rows.map(row => {
//             const item = {
//                 type: row.element_type,
//                 ...row.properties
//             };
//             if (row.label) item.label = row.label;
//             if (row.initial_value) {
//                 // 將 'true'/'false' 字串轉換為布林值
//                 if (row.initial_value === 'true') {
//                     item.initialValue = true;
//                 } else if (row.initial_value === 'false') {
//                     item.initialValue = false;
//                 } else {
//                     item.initialValue = row.initial_value;
//                 }
//             }
//             if (row.options_key) item.optionsKey = row.options_key;
//             return item;
//         });

//         // 處理 options_data 資料，並將其組合成 Map
//         const optionsData = optionsDataResult.rows;
//         const optionsDataTable = optionsData.reduce((acc, current) => {
//             const key = current.option_key;
//             // 處理 JSON 格式的資料表，使其與 Flutter 範例一致
//             if (!acc.find(item => item.key === key)) {
//                 acc.push({
//                     key: key,
//                     options: []
//                 });
//             }
//             const table = acc.find(item => item.key === key);

//             const option = {
//                 value: current.value,
//                 label: current.label,
//             };
//             // 處理連動選項的 parent_value
//             if (current.parent_value) {
//                 option.city = current.parent_value;
//             }
//             table.options.push(option);
//             return acc;
//         }, []);

//         // 將處理後的資料組合成一個最終的 JSON 物件
//         const responseData = {
//             uiDataTable: uiDataTable,
//             optionsDataTable: optionsDataTable,
//         };

//         // 發送 JSON 回應
//         res.json(responseData);

//     } catch (err) {
//         console.error('資料庫查詢錯誤', err);
//         res.status(500).json({ error: '內部伺服器錯誤' });
//     }
// });

// // 啟動伺服器
// app.listen(port, () => {
//     console.log(`伺服器正在 http://localhost:${port} 運作`);
// });

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
// 載入 dotenv 套件，它會從 .env 檔案載入環境變數
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

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

// 使用 CORS 中介軟體，允許來自不同來源的請求
app.use(cors());

// 定義 API 端點來提供 UI 資料
app.get('/api/ui-data', async (req, res) => {
    try {
        // 同時執行兩個資料庫查詢，提高效率
        const [uiElementsResult, optionsDataResult] = await Promise.all([
            pool.query('SELECT * FROM testapi.ui_elements ORDER BY element_id ASC'),
            pool.query('SELECT * FROM testapi.options_data ORDER BY option_id ASC')
        ]);

        // 處理 ui_elements 資料
        const uiDataTable = uiElementsResult.rows.map(row => {
            const item = {
                type: row.element_type
            };
            
            // 修正後的邏輯：直接將 row 中的 properties 屬性加到 item 中
            // 這樣可以正確處理來自資料庫的 JSONB 欄位
            if (row.properties) {
                item.properties = row.properties;
            }

            if (row.label) item.label = row.label;
            if (row.initial_value) {
                if (row.initial_value === 'true') {
                    item.initialValue = true;
                } else if (row.initial_value === 'false') {
                    item.initialValue = false;
                } else {
                    item.initialValue = row.initial_value;
                }
            }
            if (row.options_key) item.optionsKey = row.options_key;
            return item;
        });

        // 處理 options_data 資料，並將其組合成 Map
        const optionsData = optionsDataResult.rows;
        const optionsDataTable = optionsData.reduce((acc, current) => {
            const key = current.option_key;
            if (!acc.find(item => item.key === key)) {
                acc.push({
                    key: key,
                    options: []
                });
            }
            const table = acc.find(item => item.key === key);

            const option = {
                value: current.value,
                label: current.label,
            };
            if (current.parent_value) {
                option.city = current.parent_value;
            }
            table.options.push(option);
            return acc;
        }, []);

        const responseData = {
            uiDataTable: uiDataTable,
            optionsDataTable: optionsDataTable,
        };

        res.json(responseData);

    } catch (err) {
        console.error('資料庫查詢錯誤', err);
        res.status(500).json({ error: '內部伺服器錯誤' });
    }
});

app.listen(port, () => {
    console.log(`伺服器正在 http://localhost:${port} 運作`);
});
