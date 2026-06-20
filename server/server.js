const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'family.json');

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务（托管前端页面）
app.use(express.static(path.join(__dirname, '..')));

// 确保数据目录存在
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {}
}

// 读取数据
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    // 文件不存在，返回空数据结构
    return { members: [], messages: [], mottos: [], notices: [], settings: {} };
  }
}

// 写入数据
async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ==================== API 接口 ====================

// 获取所有数据
app.get('/api/data', async (req, res) => {
  try {
    const data = await readData();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 保存所有数据（覆盖）
app.post('/api/data', async (req, res) => {
  try {
    const data = req.body;
    await writeData(data);
    res.json({ success: true, message: '数据已保存' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取成员列表
app.get('/api/members', async (req, res) => {
  try {
    const data = await readData();
    res.json({ success: true, data: data.members || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 保存成员列表（覆盖）
app.post('/api/members', async (req, res) => {
  try {
    const data = await readData();
    data.members = req.body;
    await writeData(data);
    res.json({ success: true, message: '成员数据已保存' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取留言
app.get('/api/messages', async (req, res) => {
  try {
    const data = await readData();
    res.json({ success: true, data: data.messages || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 保存留言
app.post('/api/messages', async (req, res) => {
  try {
    const data = await readData();
    data.messages = req.body;
    await writeData(data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取家训
app.get('/api/mottos', async (req, res) => {
  try {
    const data = await readData();
    res.json({ success: true, data: data.mottos || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 保存家训
app.post('/api/mottos', async (req, res) => {
  try {
    const data = await readData();
    data.mottos = req.body;
    await writeData(data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取公告
app.get('/api/notices', async (req, res) => {
  try {
    const data = await readData();
    res.json({ success: true, data: data.notices || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 保存公告
app.post('/api/notices', async (req, res) => {
  try {
    const data = await readData();
    data.notices = req.body;
    await writeData(data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取设置
app.get('/api/settings', async (req, res) => {
  try {
    const data = await readData();
    res.json({ success: true, data: data.settings || {} });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 保存设置
app.post('/api/settings', async (req, res) => {
  try {
    const data = await readData();
    data.settings = req.body;
    await writeData(data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 导出数据（下载 JSON 文件）
app.get('/api/export', async (req, res) => {
  try {
    const data = await readData();
    res.setHeader('Content-Disposition', 'attachment; filename="lishi-zupu-backup.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 导入数据（上传 JSON 文件）
app.post('/api/import', async (req, res) => {
  try {
    const data = req.body;
    await writeData(data);
    res.json({ success: true, message: '数据导入成功' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 启动服务器
async function start() {
  await ensureDataDir();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 李氏家谱服务器已启动`);
    console.log(`   本地访问: http://localhost:${PORT}`);
    console.log(`   局域网访问: http://<你的IP>:${PORT}`);
  });
}

start();
