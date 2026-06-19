/**
 * 迁移脚本：将旧格式 JSON 备份转换为当前系统格式
 *
 * 旧格式字段 → 新格式字段：
 *   birthOrder    → birth_order
 *   birthDate     → birth_date
 *   deathDate     → death_date
 *   fatherId      → father_id
 *   motherId      → mother_id
 *   spouseId      → spouse_id
 *   ethnicity     → ethnicity  (键名相同)
 *   career        → career       (键名相同)
 *   education     → education   (键名相同)
 *   phone         → phone       (键名相同)
 *   address       → address     (键名相同)
 *   bio           → bio         (键名相同)
 *   name/gender/generation → 不变
 *
 * 新增字段（默认 null）：courtesy_name, art_name,
 *   ancestral_home, generation_poem, burial_site, avatar
 *
 * 使用：node migrate-legacy-json.js <输入文件.json> [输出文件.json]
 */

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3] || 'migrated-data.json';

if (!inputFile) {
  console.error('用法：node migrate-legacy-json.js <输入文件.json> [输出文件.json]');
  process.exit(1);
}

// 需要重命名的字段：旧键 → 新键
const RENAME_MAP = {
  birthOrder: 'birth_order',
  birthDate:  'birth_date',
  deathDate:  'death_date',
  fatherId:   'father_id',
  motherId:   'mother_id',
  spouseId:   'spouse_id',
};

// 键名不变的字段（直接复制）
const COPY_FIELDS = [
  'name', 'gender', 'generation',
  'ethnicity', 'education', 'career',
  'phone', 'address', 'bio',
];

// 新增字段默认值
const NEW_FIELDS = {
  courtesy_name:   null,
  art_name:        null,
  ancestral_home:  null,
  generation_poem: null,
  burial_site:     null,
  avatar:          null,
};

function migrateMembers(oldMembers) {
  // 建立新旧 ID 映射（旧字符串 ID → 新数字 ID）
  const idMap = new Map();
  oldMembers.forEach((m, i) => {
    idMap.set(m.id, i + 1);
  });

  const newMembers = oldMembers.map((old, i) => {
    const nm = { id: i + 1 };

    // 复制键名不变的字段
    for (const key of COPY_FIELDS) {
      if (old[key] !== undefined) {
        nm[key] = old[key];
      }
    }

    // 重命名字段
    for (const [oldKey, newKey] of Object.entries(RENAME_MAP)) {
      if (old[oldKey] !== undefined) {
        nm[newKey] = old[oldKey];
      }
    }

    // 关系字段：将旧字符串 ID 转换为新数字 ID
    nm.father_id = (old.fatherId && idMap.has(old.fatherId))
      ? idMap.get(old.fatherId) : null;
    nm.mother_id = (old.motherId && idMap.has(old.motherId))
      ? idMap.get(old.motherId) : null;
    nm.spouse_id = (old.spouseId && idMap.has(old.spouseId))
      ? idMap.get(old.spouseId) : null;

    // 新增字段
    Object.assign(nm, NEW_FIELDS);

    // 默认值
    if (!nm.ethnicity) nm.ethnicity = '汉族';
    if (!nm.gender) nm.gender = '男';
    if (!nm.generation) nm.generation = 1;

    return nm;
  });

  return { members: newMembers, idMap };
}

function migrateOtherStores(oldData) {
  const result = {};
  for (const [key, value] of Object.entries(oldData)) {
    if (key === 'members') continue;
    if (Array.isArray(value)) {
      result[key] = value.map((item, i) => {
        const newItem = { ...item };
        if (item.id && typeof item.id === 'string') {
          newItem.id = i + 1;
        }
        return newItem;
      });
    } else {
      result[key] = value;
    }
  }
  return result;
}

// 主流程
try {
  const raw = fs.readFileSync(inputFile, 'utf8');
  const oldData = JSON.parse(raw);

  if (!oldData.members) {
    console.error('错误：输入文件缺少 members 字段');
    process.exit(1);
  }

  console.log(`读取到 ${oldData.members.length} 个成员记录`);

  const { members: newMembers, idMap } = migrateMembers(oldData.members);
  console.log(`已转换成员记录，新旧 ID 映射数量：${idMap.size}`);

  // 验证关系字段
  let relationErrors = 0;
  for (const m of newMembers) {
    if (m.father_id && !newMembers.find(x => x.id === m.father_id)) {
      console.warn(`  警告：成员 ${m.name}(id=${m.id}) 的 father_id=${m.father_id} 不存在`);
      relationErrors++;
    }
    if (m.mother_id && !newMembers.find(x => x.id === m.mother_id)) {
      console.warn(`  警告：成员 ${m.name}(id=${m.id}) 的 mother_id=${m.mother_id} 不存在`);
      relationErrors++;
    }
    if (m.spouse_id && !newMembers.find(x => x.id === m.spouse_id)) {
      console.warn(`  警告：成员 ${m.name}(id=${m.id}) 的 spouse_id=${m.spouse_id} 不存在`);
      relationErrors++;
    }
  }
  if (relationErrors > 0) {
    console.warn(`  共有 ${relationErrors} 个关系引用错误`);
  }

  const newData = {
    members: newMembers,
    ...migrateOtherStores(oldData),
  };

  fs.writeFileSync(
    outputFile,
    JSON.stringify(newData, null, 2),
    'utf8'
  );

  console.log(`✅ 迁移完成！输出文件：${outputFile}`);
  console.log(`   成员数量：${newMembers.length}`);
  console.log(`   示例第一条记录：`);
  console.log(JSON.stringify(newMembers[0], null, 2));

} catch (e) {
  console.error('❌ 迁移失败：', e.message);
  console.error(e.stack);
  process.exit(1);
}
