import { app, BrowserWindow, ipcMain } from "electron";
import * as fs from 'fs';
import * as sqlite from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import sha256 from 'sha256';
const csvParser = require('csv-parser');
const csvStream = require('csv-write-stream');
import '@babel/polyfill';

declare const ENVIRONMENT: String;

const IS_DEV = ENVIRONMENT == "development";
const DEV_SERVER_URL = "http://localhost:9000";
const HTML_FILE_PATH = "index.html";

const databasePath = path.resolve(__dirname, 'database.sqlite3');
console.log(databasePath);
let win: BrowserWindow | null = null;
let stopProcessFlag = false;

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    });

    if (IS_DEV) {
        win.loadURL(DEV_SERVER_URL);
        // win.webContents.openDevTools();
    }
    else {
        win.loadFile(HTML_FILE_PATH);
    }


    win.on("closed", () => {
        win = null
    })
}

app.on("ready", () => {
    createWindow();
    let db = new sqlite.Database(databasePath, (err: any) => {
        if (err) { return console.log(err) };
    });
    db.run(`CREATE TABLE IF NOT EXISTS Records (
        id INTEGER PRIMARY KEY,
        vk_id INTEGER,
        email TEXT,
        email_sha256 TEXT,
        phone INTEGER,
        phone_sha256 TEXT,
        first_name TEXT,
        last_name TEXT,
        bdate TEXT,
        city TEXT,
        IE INTEGER,
        SN INTEGER,
        TF INTEGER,
        JP INTEGER
    )`, [], (err) => {
        if (err) { return console.log(err) };
        db.run(`CREATE INDEX IF NOT EXISTS idx_records ON Records (email, phone)`, [], (err) => { if (err) { return console.log(err) } });
        db.run(`CREATE INDEX IF NOT EXISTS idx_email_hashes ON Records (email_sha256)`, [], (err) => { if (err) { return console.log(err) } });
        db.run(`CREATE INDEX IF NOT EXISTS idx_phone_hashes ON Records (phone_sha256)`, [], (err) => { if (err) { return console.log(err) } });
    });
    db.close();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})

app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
})

const dbQuery = function (query: string, db: sqlite.Database): Promise<any> {
    return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
            if (err) { return reject(err) }
            resolve(rows);
        });
    })
}

const dbQuerySingle = function (query: string, db: sqlite.Database): Promise<any> {
    return new Promise((resolve, reject) => {
        db.get(query, [], (err, row) => {
            if (err) { return reject(err) }
            resolve(row);
        });
    })
}

const dbInsert = function (query: string, db: sqlite.Database): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(query, (err) => {
            if (err) {
                console.log(err);
                console.log(query);
            }
            resolve()
        });
    })
}

ipcMain.on('proceed-analyse', async (args, data: { filePath: string }) => {
    const userName = os.userInfo().username;
    const destinationPath = `C:\\Users\\${userName}\\Desktop\\result${Date.now().toString()}.csv`;
    const writer = csvStream();
    const csvWriteStream = fs.createWriteStream(destinationPath, { flags: 'a' });
    writer.pipe(csvWriteStream);
    const dataReadStream = fs.createReadStream(data.filePath).pipe(csvParser());
    const db = new sqlite.Database(databasePath, (err: any) => {
        if (err) { return console.log(err) };
    });
    let totalCount = 0;
    for await (const data of dataReadStream) {
        let query = "SELECT * FROM Records INDEXED BY idx_records WHERE ";
        if (data.email && data.email !== '' && data.phone && data.phone !== '') {
            query += `email=\'${data.email.toLowerCase()}\' AND phone=\'${data.phone}\'`;
        } else if (data.email && data.email !== '') {
            query += `email=\'${data.email.toLowerCase()}\'`
        } else if (data.phone && data.phone !== '') {
            query += `phone=\'${data.phone}\'`;
        }
        const result = await dbQuerySingle(query, db);
        if (result) { writer.write(result); totalCount++; console.log("Processed count: " + totalCount) };
    }
    writer.end();
    db.close();
    console.log("Finished. Total count: " + totalCount);
})

ipcMain.on('email-analyse', async (args, data: { filePath: string }) => {
    const userName = os.userInfo().username;
    const destinationPath = `C:\\Users\\${userName}\\Desktop\\result${Date.now().toString()}.csv`;
    const writer = csvStream();
    const csvWriteStream = fs.createWriteStream(destinationPath, { flags: 'a' });
    writer.pipe(csvWriteStream);
    const dataReadStream = fs.createReadStream(data.filePath).pipe(csvParser());
    const db = new sqlite.Database(databasePath, (err: any) => {
        if (err) { return console.log(err) };
    });
    let totalCount = 0;
    let foundItemsCount = 0;
    let hashArray: string[] = [];
    for await (const data of dataReadStream) {
        let query = "SELECT * FROM Records INDEXED BY idx_email_hashes WHERE ";
        if (!data.email || data.email === '') { continue; }
        hashArray.push(`\'${data.email}\'`);
        if (hashArray.length === 1000) {
            query += `email_sha256 IN (${hashArray})`;
            const result = await dbQuery(query, db);
            if (result) {
                for (const r of result) { writer.write(r); }
                totalCount += hashArray.length;
                foundItemsCount += result.length;
                console.log("Processed count: " + totalCount)
            };
            query = "SELECT * FROM Records INDEXED BY idx_email_hashes WHERE ";
            hashArray = [];
        }
    }
    if (hashArray.length > 0) {
        let query = "SELECT * FROM Records INDEXED BY idx_email_hashes WHERE ";
        query += `email_sha256 IN (${hashArray})`;
        const result = await dbQuery(query, db);
        if (result) {
            for (const r of result) { writer.write(r); }
            totalCount += hashArray.length;
            foundItemsCount += result.length;
            console.log("Processed count: " + totalCount)
        };
    }
    writer.end();
    db.close();
    console.log("Finished. Found elements: " + foundItemsCount);
})

ipcMain.on('phone-analyse', async (args, data: { filePath: string }) => {
    const userName = os.userInfo().username;
    const destinationPath = `C:\\Users\\${userName}\\Desktop\\result${Date.now().toString()}.csv`;
    const writer = csvStream();
    const csvWriteStream = fs.createWriteStream(destinationPath, { flags: 'a' });
    writer.pipe(csvWriteStream);
    const dataReadStream = fs.createReadStream(data.filePath).pipe(csvParser());
    const db = new sqlite.Database(databasePath, (err: any) => {
        if (err) { return console.log(err) };
    });
    let totalCount = 0;
    let foundItemsCount = 0;
    let hashArray: string[] = [];
    for await (const data of dataReadStream) {
        let query = "SELECT * FROM Records INDEXED BY idx_phone_hashes WHERE ";
        if (!data.phone || data.phone === '') { continue; }
        hashArray.push(`\'${data.phone}\'`);
        if (hashArray.length === 1000) {
            query += `phone_sha256 IN (${hashArray})`;
            const result = await dbQuery(query, db);
            if (result) {
                for (const r of result) { writer.write(r); }
                totalCount += hashArray.length;
                foundItemsCount += result.length;
                console.log("Processed count: " + totalCount)
            };
            query = "SELECT * FROM Records INDEXED BY idx_phone_hashes WHERE ";
            hashArray = [];
        }
    }
    if (hashArray.length > 0) {
        let query = "SELECT * FROM Records INDEXED BY idx_phone_hashes WHERE ";
        query += `phone_sha256 IN (${hashArray})`;
        const result = await dbQuery(query, db);
        if (result) {
            for (const r of result) { writer.write(r); }
            totalCount += hashArray.length;
            foundItemsCount += result.length;
            console.log("Processed count: " + totalCount)
        };
    }
    writer.end();
    db.close();
    console.log("Finished. Found elements: " + foundItemsCount);
})

ipcMain.on('proceed-load', (args, data: { filePath: string }) => {
    let db = new sqlite.Database(databasePath, (err: any) => {
        if (err) { return console.log(err) };
    });
    db.parallelize(async () => {
        const dataReadStream = fs.createReadStream(data.filePath).pipe(csvParser());
        let dataCount = 0;
        let totalCount = 0;
        let mainQuery = "INSERT INTO Records (vk_id, email, email_sha256, phone, phone_sha256, first_name, last_name, bdate, city, IE, SN, TF, JP) VALUES ";
        for await (const data of dataReadStream) {
            let obj = { ...data };
            for (let i in obj) {
                obj[i] = obj[i].replace(/\'/g, "''");
            }
            if (obj.email) { obj.email_sha256 = sha256(obj.email); } else { obj.email_sha256 = ''; }
            if (obj.phone) { obj.phone_sha256 = sha256(obj.phone); } else { obj.phone_sha256 = ''; }
            if (dataCount === 999) {
                mainQuery += `(${obj.id}, \'${obj.email}\', \'${obj.email_sha256}\', \'${obj.phone}\', \'${obj.phone_sha256}\', \'${obj.first_name}\', \'${obj.last_name}\', \'${obj.bdate}\', \'${obj.city}\', ${obj.IE ? obj.IE : 'null'}, ${obj.SN ? obj.SN : 'null'}, ${obj.TF ? obj.TF : 'null'}, ${obj.JP ? obj.JP : 'null'})`;
            } else {
                mainQuery += `(${obj.id}, \'${obj.email}\', \'${obj.email_sha256}\', \'${obj.phone}\', \'${obj.phone_sha256}\', \'${obj.first_name}\', \'${obj.last_name}\', \'${obj.bdate}\', \'${obj.city}\', ${obj.IE ? obj.IE : 'null'}, ${obj.SN ? obj.SN : 'null'}, ${obj.TF ? obj.TF : 'null'}, ${obj.JP ? obj.JP : 'null'}), `;
            }
            dataCount++;
            totalCount++;
            if (dataCount === 1000) {
                console.log("Querying...");
                await dbInsert(mainQuery, db);
                console.log("TotalCount: " + totalCount);
                mainQuery = "INSERT INTO Records (vk_id, email, email_sha256, phone, phone_sha256, first_name, last_name, bdate, city, IE, SN, TF, JP) VALUES ";
                dataCount = 0;
            }
            if (stopProcessFlag) {
                stopProcessFlag = false;
                break
            }
        };
        console.log("Loading finished!");
        db.close()
    })
})

// ipcMain.on('proceed-load', async (args, data) => {
//     const dataReadStream = fs.createReadStream(data.filePath).pipe(csvParser());
//     const userName = os.userInfo().username;
//     const destinationPath = `C:\\Users\\${userName}\\Desktop\\result.csv`;
//     const writer = csvStream();
//     const csvWriteStream = fs.createWriteStream(destinationPath, { flags: 'a' });
//     writer.pipe(csvWriteStream);
//     let totalCount = 0;
//     for await (const d of dataReadStream) {
//         if (totalCount <= 5943081) {
//             totalCount++;
//             continue;
//         }
//         const obj = { ...d };
//         if (obj.email) { obj.email_sha256 = sha256(obj.email); } else { obj.phone_sha256 = ''; }
//         if (obj.phone) { obj.phone_sha256 = sha256(obj.phone); } else { obj.phone_sha256 = ''; }
//         writer.write(obj);
//         if (stopProcessFlag) {
//             stopProcessFlag = false;
//             writer.end();
//             break
//         };
//         totalCount++;
//         console.log('Processed count: ', totalCount);
//     }
//     writer.end();
// })

ipcMain.on('stop-process', (args: any, data: any) => {
    stopProcessFlag = true;
})
