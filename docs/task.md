# Qwen3-TTS 多人对话功能开发任务分解

## 项目概述

基于 design.md 设计文档，将多人对话功能开发分为 8 个独立阶段，每个阶段可独立测试，渐进式构建完整功能。

**技术栈**:
- 后端：FastAPI + SQLAlchemy + WebSocket
- 前端：React 19 + TypeScript + shadcn/ui
- 新增功能：5 个数据模型 + 31 个 API 端点 + 实时生成 + 音频合并

**预计工作量**: 24-40 天（5-8 周）

---

## 阶段 1: 数据模型和数据库迁移

**工期**: 3-5天
**目标**: 建立数据层基础，创建 5 个新数据模型

### 新建文件

#### 后端数据模型
- `qwen3-tts-backend/db/models_dialogue.py`
  - `VoiceLibrary` - 音色库（名称、参数、预览音频）
  - `Character` - 角色（名称、头像、颜色、音色来源）
  - `Dialogue` - 对话会话（标题、角色列表、总时长）
  - `DialogueLine` - 对话行（角色、文本、顺序、音频路径）
  - `DialogueLineGeneration` - 生成记录（状态、进度、错误信息）

#### Schemas
- `qwen3-tts-backend/schemas/voice_library.py`
  - `VoiceLibraryCreate` - 创建音色库
  - `VoiceLibraryUpdate` - 更新音色库
  - `VoiceLibraryResponse` - 返回音色库
  - `VoiceLibraryWithReferences` - 带引用计数

- `qwen3-tts-backend/schemas/character.py`
  - `CharacterCreate` - 创建角色
  - `CharacterUpdate` - 更新角色
  - `CharacterResponse` - 返回角色
  - `CharacterWithVoice` - 带完整音色信息

- `qwen3-tts-backend/schemas/dialogue.py`
  - `DialogueCreate` - 创建对话
  - `DialogueUpdate` - 更新对话
  - `DialogueResponse` - 返回对话
  - `DialogueLineCreate` - 创建对话行
  - `DialogueLineUpdate` - 更新对话行
  - `DialogueLineResponse` - 返回对话行

#### CRUD 操作
- `qwen3-tts-backend/db/crud_dialogue.py`
  - `create_voice_library()` - 创建音色库
  - `get_voice_libraries()` - 查询音色库列表
  - `update_voice_library()` - 更新音色库
  - `delete_voice_library()` - 删除音色库（检查引用）
  - `create_character()` - 创建角色
  - `get_characters()` - 查询角色列表
  - `update_character()` - 更新角色
  - `delete_character()` - 删除角色（检查引用）
  - `create_dialogue()` - 创建对话
  - `get_dialogues()` - 查询对话列表
  - `update_dialogue()` - 更新对话
  - `delete_dialogue()` - 删除对话
  - `create_dialogue_line()` - 创建对话行
  - `get_dialogue_lines()` - 查询对话行列表
  - `update_dialogue_line()` - 更新对话行
  - `delete_dialogue_line()` - 删除对话行
  - `reorder_dialogue_lines()` - 重新排序对话行

### 修改文件

- `qwen3-tts-backend/db/models.py`
  - 导入 `models_dialogue` 中的所有模型

- `qwen3-tts-backend/db/__init__.py`
  - 导出新的数据模型类

### 数据库字段详情

#### VoiceLibrary 表
```
- id: UUID (主键)
- user_id: UUID (外键 → users.id)
- name: String(100) - 音色名称
- description: Text - 描述（可选）
- tts_params: JSON - TTS 参数（speed, pitch 等）
- preview_audio_path: String(500) - 预览音频路径
- created_at: DateTime
- updated_at: DateTime

索引: user_id, name
外键: ON DELETE CASCADE
```

#### Character 表
```
- id: UUID (主键)
- user_id: UUID (外键 → users.id)
- name: String(100) - 角色名称
- avatar_type: Enum('icon', 'upload', 'initial') - 头像类型
- avatar_value: String(200) - 头像值（图标名/文件路径/首字母）
- color: String(7) - 颜色代码（#RRGGBB）
- voice_source_type: Enum('voice_library', 'custom', 'job') - 音色来源
- voice_library_id: UUID (外键 → voice_library.id, 可选)
- custom_tts_params: JSON - 自定义 TTS 参数（可选）
- job_id: UUID (外键 → jobs.id, 可选)
- created_at: DateTime
- updated_at: DateTime

索引: user_id, name, voice_library_id, job_id
外键: ON DELETE SET NULL (voice_library_id, job_id)
```

#### Dialogue 表
```
- id: UUID (主键)
- user_id: UUID (外键 → users.id)
- title: String(200) - 对话标题
- description: Text - 描述（可选）
- character_ids: JSON - 角色 ID 数组
- total_lines: Integer - 总对话行数
- generated_lines: Integer - 已生成行数
- total_duration: Float - 总时长（秒）
- status: Enum('draft', 'generating', 'completed', 'error') - 状态
- created_at: DateTime
- updated_at: DateTime

索引: user_id, status, created_at
外键: ON DELETE CASCADE
```

#### DialogueLine 表
```
- id: UUID (主键)
- dialogue_id: UUID (外键 → dialogues.id)
- character_id: UUID (外键 → characters.id)
- text: Text - 对话文本（最大 2000 字符）
- order: Integer - 顺序号（从 0 开始）
- audio_path: String(500) - 生成的音频路径（可选）
- duration: Float - 音频时长（秒，可选）
- status: Enum('pending', 'generating', 'completed', 'error') - 状态
- error_message: Text - 错误信息（可选）
- created_at: DateTime
- updated_at: DateTime

索引: dialogue_id + order (唯一)
外键: ON DELETE CASCADE
```

#### DialogueLineGeneration 表
```
- id: UUID (主键)
- dialogue_id: UUID (外键 → dialogues.id)
- user_id: UUID (外键 → users.id)
- total_lines: Integer - 总行数
- generated_lines: Integer - 已生成行数
- failed_lines: Integer - 失败行数
- current_line_order: Integer - 当前处理行号（可选）
- status: Enum('pending', 'generating', 'paused', 'completed', 'cancelled', 'error') - 状态
- started_at: DateTime - 开始时间（可选）
- completed_at: DateTime - 完成时间（可选）
- error_message: Text - 错误信息（可选）
- created_at: DateTime

索引: dialogue_id, user_id, status
外键: ON DELETE CASCADE
```

### 验收标准

- [ ] 数据库迁移成功，创建 5 个新表
- [ ] 所有索引和外键约束生效
- [ ] JSON 字段（tts_params, character_ids, custom_tts_params）正确序列化/反序列化
- [ ] 外键级联删除正常工作
- [ ] CRUD 函数可以正确创建、查询、更新、删除记录
- [ ] 角色删除时检查对话行引用（不允许删除被引用的角色）
- [ ] 音色库删除时检查角色引用（不允许删除被引用的音色库）

### 测试命令

```bash
cd qwen3-tts-backend
alembic revision --autogenerate -m "Add dialogue models"
alembic upgrade head
pytest tests/test_dialogue_models.py -v
```

---

## 阶段 2: 音色库管理（后端+前端）

**工期**: 3-5天
**目标**: 实现音色库的 CRUD 功能，支持预览音频生成

### 后端新建文件

#### API 端点
- `qwen3-tts-backend/api/voice_library.py`
  - `POST /api/voice-library` - 创建音色库（生成预览音频）
  - `GET /api/voice-library` - 获取音色库列表（分页、搜索）
  - `GET /api/voice-library/{id}` - 获取单个音色库详情
  - `PATCH /api/voice-library/{id}` - 更新音色库
  - `DELETE /api/voice-library/{id}` - 删除音色库
  - `GET /api/voice-library/{id}/references` - 获取引用该音色库的角色列表
  - `POST /api/voice-library/{id}/regenerate-preview` - 重新生成预览音频

#### 工具函数
- `qwen3-tts-backend/utils/voice_preview.py`
  - `generate_preview_audio()` - 生成预览音频（3-5秒示例文本）
  - `delete_preview_audio()` - 删除预览音频文件
  - 预览文本示例：["你好，我是 AI 语音助手", "这是我的声音预览"]

### 前端新建文件

#### Context
- `qwen3-tts-frontend/src/contexts/VoiceLibraryContext.tsx`
  - `useVoiceLibrary()` hook
  - 状态管理：voices, loading, error
  - 方法：fetchVoices, createVoice, updateVoice, deleteVoice

#### 页面
- `qwen3-tts-frontend/src/pages/VoiceLibrary.tsx`
  - 音色库列表页面
  - 搜索框、创建按钮、音色卡片网格
  - 导航路由：`/voice-library`

#### 组件
- `qwen3-tts-frontend/src/components/voice-library/VoiceCard.tsx`
  - 音色卡片（显示名称、描述、参数、预览按钮）
  - 操作按钮：播放预览、编辑、删除

- `qwen3-tts-frontend/src/components/voice-library/VoiceForm.tsx`
  - 音色库创建/编辑表单
  - 字段：名称、描述、TTS 参数（speed, pitch, volume）
  - 预览文本输入框

- `qwen3-tts-frontend/src/components/voice-library/VoiceFormDialog.tsx`
  - 对话框包装器（创建/编辑）

- `qwen3-tts-frontend/src/components/voice-library/AudioPreviewPlayer.tsx`
  - 音频预览播放器
  - 支持播放/暂停、进度条

- `qwen3-tts-frontend/src/components/voice-library/DeleteConfirmDialog.tsx`
  - 删除确认对话框
  - 显示引用警告（如果有角色使用该音色库）

#### API 客户端
- `qwen3-tts-frontend/src/lib/api/voices.ts`
  - `getVoices()` - 获取音色库列表
  - `getVoiceById()` - 获取单个音色库
  - `createVoice()` - 创建音色库
  - `updateVoice()` - 更新音色库
  - `deleteVoice()` - 删除音色库
  - `getVoiceReferences()` - 获取引用列表
  - `regeneratePreview()` - 重新生成预览

### 修改文件

#### 路由注册
- `qwen3-tts-backend/main.py`
  - 添加 `voice_library` 路由

#### 前端路由
- `qwen3-tts-frontend/src/App.tsx`
  - 添加 `/voice-library` 路由

#### 导航菜单
- `qwen3-tts-frontend/src/components/Navigation.tsx`
  - 添加"音色库"菜单项

### 环境变量配置

```bash
# qwen3-tts-backend/.env
VOICE_LIBRARY_OUTPUT_DIR=./outputs/voice-library
```

```python
# qwen3-tts-backend/core/config.py
VOICE_LIBRARY_OUTPUT_DIR: str = "./outputs/voice-library"
```

### API 规格

#### POST /api/voice-library
请求体：
```json
{
  "name": "温柔女声",
  "description": "适合讲故事的温柔女声",
  "tts_params": {
    "speed": 1.0,
    "pitch": 0,
    "volume": 1.0
  },
  "preview_text": "你好，我是 AI 语音助手"
}
```

响应：
```json
{
  "id": "uuid",
  "name": "温柔女声",
  "description": "适合讲故事的温柔女声",
  "tts_params": { "speed": 1.0, "pitch": 0, "volume": 1.0 },
  "preview_audio_path": "/outputs/voice-library/uuid.wav",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### GET /api/voice-library
查询参数：
- `page`: 页码（默认 1）
- `page_size`: 每页数量（默认 20）
- `search`: 搜索关键词（名称/描述）

响应：
```json
{
  "items": [...],
  "total": 50,
  "page": 1,
  "page_size": 20
}
```

### 验收标准

- [ ] 创建音色库，自动生成预览音频
- [ ] 音色库列表正确显示，支持分页和搜索
- [ ] 预览音频播放功能正常
- [ ] 更新音色库参数，可重新生成预览
- [ ] 删除音色库前检查引用（如有角色使用，显示警告并阻止删除）
- [ ] 删除音色库时同步删除预览音频文件
- [ ] UI 响应流畅，错误提示清晰

### 测试命令

```bash
cd qwen3-tts-backend
pytest tests/test_voice_library.py -v

cd qwen3-tts-frontend
npm run test -- voice-library
```

---

## 阶段 3: 角色管理（后端+前端）

**工期**: 3-5天
**目标**: 实现角色 CRUD，支持音色绑定（音色库/自定义参数/Job）

### 后端新建文件

#### API 端点
- `qwen3-tts-backend/api/character.py`
  - `POST /api/characters` - 创建角色
  - `GET /api/characters` - 获取角色列表（分页、搜索、按对话筛选）
  - `GET /api/characters/{id}` - 获取单个角色详情（包含完整音色信息）
  - `PATCH /api/characters/{id}` - 更新角色
  - `DELETE /api/characters/{id}` - 删除角色

### 前端新建文件

#### Context
- `qwen3-tts-frontend/src/contexts/CharacterContext.tsx`
  - `useCharacter()` hook
  - 状态管理：characters, loading, error
  - 方法：fetchCharacters, createCharacter, updateCharacter, deleteCharacter

#### 页面
- `qwen3-tts-frontend/src/pages/Characters.tsx`
  - 角色列表页面
  - 搜索框、创建按钮、角色卡片网格
  - 导航路由：`/characters`

#### 组件
- `qwen3-tts-frontend/src/components/character/CharacterCard.tsx`
  - 角色卡片（显示头像、名称、音色来源）
  - 操作按钮：编辑、删除、测试音色

- `qwen3-tts-frontend/src/components/character/CharacterForm.tsx`
  - 角色创建/编辑表单
  - 字段：名称、头像、颜色、音色来源

- `qwen3-tts-frontend/src/components/character/CharacterFormDialog.tsx`
  - 对话框包装器（创建/编辑）

- `qwen3-tts-frontend/src/components/character/AvatarPicker.tsx`
  - 头像选择器
  - 三种模式：图标库（Lucide icons）、上传图片、首字母

- `qwen3-tts-frontend/src/components/character/ColorPicker.tsx`
  - 颜色选择器
  - 预设颜色 + 自定义颜色

- `qwen3-tts-frontend/src/components/character/VoiceSourceSelector.tsx`
  - 音色来源选择器
  - 三种模式：
    - 音色库（下拉选择 + 预览）
    - 自定义参数（speed, pitch, volume 滑块）
    - 历史 Job（选择已完成的 Job）

#### API 客户端
- `qwen3-tts-frontend/src/lib/api/characters.ts`
  - `getCharacters()` - 获取角色列表
  - `getCharacterById()` - 获取单个角色
  - `createCharacter()` - 创建角色
  - `updateCharacter()` - 更新角色
  - `deleteCharacter()` - 删除角色

### 修改文件

#### 路由注册
- `qwen3-tts-backend/main.py`
  - 添加 `character` 路由

#### 前端路由
- `qwen3-tts-frontend/src/App.tsx`
  - 添加 `/characters` 路由

#### 导航菜单
- `qwen3-tts-frontend/src/components/Navigation.tsx`
  - 添加"角色管理"菜单项

### API 规格

#### POST /api/characters
请求体（音色库模式）：
```json
{
  "name": "小明",
  "avatar_type": "initial",
  "avatar_value": "M",
  "color": "#3B82F6",
  "voice_source_type": "voice_library",
  "voice_library_id": "uuid"
}
```

请求体（自定义参数模式）：
```json
{
  "name": "小红",
  "avatar_type": "icon",
  "avatar_value": "UserCircle",
  "color": "#EF4444",
  "voice_source_type": "custom",
  "custom_tts_params": {
    "speed": 1.2,
    "pitch": 5,
    "volume": 1.0
  }
}
```

请求体（Job 模式）：
```json
{
  "name": "旁白",
  "avatar_type": "upload",
  "avatar_value": "/uploads/avatar.png",
  "color": "#8B5CF6",
  "voice_source_type": "job",
  "job_id": "uuid"
}
```

响应：
```json
{
  "id": "uuid",
  "name": "小明",
  "avatar_type": "initial",
  "avatar_value": "M",
  "color": "#3B82F6",
  "voice_source_type": "voice_library",
  "voice_library_id": "uuid",
  "voice_library": {
    "name": "温柔女声",
    "tts_params": { "speed": 1.0, "pitch": 0, "volume": 1.0 }
  },
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### GET /api/characters
查询参数：
- `page`: 页码（默认 1）
- `page_size`: 每页数量（默认 50）
- `search`: 搜索关键词（名称）
- `dialogue_id`: 按对话筛选（可选）

### UI 设计要点

#### 头像选择器
- **图标模式**：下拉菜单，常用图标（User, UserCircle, Users, Bot, Mic, MessageSquare）
- **上传模式**：拖拽上传或点击选择，支持 PNG/JPG，最大 2MB
- **首字母模式**：自动提取角色名首字符，支持中英文

#### 颜色选择器
- 预设颜色：8-12 个常用颜色（蓝、红、绿、紫、橙、粉、黄、青）
- 自定义颜色：颜色拾取器（HEX 输入）

#### 音色来源选择器
- **音色库模式**：
  - 下拉列表，显示音色库名称和描述
  - 预览按钮（播放预览音频）

- **自定义参数模式**：
  - Speed 滑块：0.5 - 2.0，步长 0.1
  - Pitch 滑块：-12 - 12，步长 1
  - Volume 滑块：0.0 - 1.5，步长 0.1
  - 测试按钮（生成临时预览音频）

- **Job 模式**：
  - 下拉列表，显示最近 20 个已完成的 Job
  - 显示 Job 标题和创建时间
  - 预览按钮（播放 Job 音频）

### 验收标准

- [ ] 创建角色，三种音色来源模式都能正常工作
- [ ] 头像选择器（图标/上传/首字母）功能正常
- [ ] 颜色选择器可以选择预设颜色或自定义颜色
- [ ] 音色库模式：下拉列表显示所有音色库，预览播放正常
- [ ] 自定义参数模式：滑块调整参数，测试音频生成正常
- [ ] Job 模式：显示历史 Job，预览播放正常
- [ ] 更新角色信息，包括切换音色来源
- [ ] 删除角色前检查引用（如有对话行使用，显示警告并阻止删除）
- [ ] 角色列表支持搜索和分页

### 测试命令

```bash
cd qwen3-tts-backend
pytest tests/test_character.py -v

cd qwen3-tts-frontend
npm run test -- character
```

---

## 阶段 4: 对话编辑器基础

**工期**: 3-5天
**目标**: 对话 CRUD + 表格编辑器 + 撤销/重做 + 实时保存

### 后端新建文件

#### API 端点
- `qwen3-tts-backend/api/dialogue.py`
  - `POST /api/dialogues` - 创建对话
  - `GET /api/dialogues` - 获取对话列表（分页、搜索、按状态筛选）
  - `GET /api/dialogues/{id}` - 获取单个对话详情
  - `PATCH /api/dialogues/{id}` - 更新对话（标题、描述、角色列表）
  - `DELETE /api/dialogues/{id}` - 删除对话
  - `POST /api/dialogues/{id}/duplicate` - 复制对话

- `qwen3-tts-backend/api/dialogue_line.py`
  - `POST /api/dialogues/{id}/lines` - 创建对话行
  - `GET /api/dialogues/{id}/lines` - 获取对话行列表
  - `PATCH /api/dialogue-lines/{line_id}` - 更新对话行
  - `DELETE /api/dialogue-lines/{line_id}` - 删除对话行

#### 工具函数
- `qwen3-tts-backend/utils/file_cleanup.py`
  - `cleanup_dialogue_audio()` - 删除对话关联的音频文件
  - `cleanup_line_audio()` - 删除对话行音频文件

### 前端新建文件

#### Context
- `qwen3-tts-frontend/src/contexts/DialogueContext.tsx`
  - `useDialogue()` hook
  - 状态管理：dialogues, currentDialogue, lines, loading, error
  - 方法：fetchDialogues, createDialogue, updateDialogue, deleteDialogue
  - 方法：fetchLines, createLine, updateLine, deleteLine

#### 页面
- `qwen3-tts-frontend/src/pages/DialogueEditor.tsx`
  - 对话编辑器主页面
  - 顶部工具栏：标题编辑、角色选择器、保存状态
  - 对话行表格编辑器
  - 导航路由：`/dialogues/:id`

#### 组件
- `qwen3-tts-frontend/src/components/dialogue/DialogueList.tsx`
  - 对话列表页面（`/dialogues`）
  - 对话卡片网格、创建按钮、搜索框

- `qwen3-tts-frontend/src/components/dialogue/DialogueCard.tsx`
  - 对话卡片（标题、进度、角色头像、状态徽章）
  - 操作按钮：编辑、复制、删除

- `qwen3-tts-frontend/src/components/dialogue/DialogueToolbar.tsx`
  - 顶部工具栏
  - 标题输入框（实时保存）
  - 角色选择器（多选）
  - 撤销/重做按钮
  - 保存状态指示器

- `qwen3-tts-frontend/src/components/dialogue/DialogueTable.tsx`
  - 对话行表格编辑器
  - 列：序号、角色选择器、文本输入框、操作按钮
  - 快捷键支持

- `qwen3-tts-frontend/src/components/dialogue/DialogueLineRow.tsx`
  - 对话行单行组件
  - 角色下拉选择器
  - 文本输入框（多行自动扩展）
  - 操作按钮：删除、复制

- `qwen3-tts-frontend/src/components/dialogue/CharacterSelector.tsx`
  - 角色选择器（多选）
  - 显示角色头像和名称
  - 添加/移除角色

- `qwen3-tts-frontend/src/components/dialogue/QuickAddCharacterDialog.tsx`
  - 快速添加角色对话框
  - 简化版角色创建表单

#### Hooks
- `qwen3-tts-frontend/src/hooks/useUndoRedo.ts`
  - 撤销/重做功能
  - 历史记录管理（最多 20 步）
  - 快捷键：Ctrl+Z（撤销）、Ctrl+Y（重做）

- `qwen3-tts-frontend/src/hooks/useKeyboardShortcuts.ts`
  - 键盘快捷键管理
  - 快捷键：
    - Enter：新建对话行
    - Ctrl+D：复制当前行
    - Ctrl+Z：撤销
    - Ctrl+Y：重做
    - Delete：删除当前行

#### API 客户端
- `qwen3-tts-frontend/src/lib/api/dialogues.ts`
  - `getDialogues()` - 获取对话列表
  - `getDialogueById()` - 获取单个对话
  - `createDialogue()` - 创建对话
  - `updateDialogue()` - 更新对话
  - `deleteDialogue()` - 删除对话
  - `duplicateDialogue()` - 复制对话
  - `getDialogueLines()` - 获取对话行列表
  - `createDialogueLine()` - 创建对话行
  - `updateDialogueLine()` - 更新对话行
  - `deleteDialogueLine()` - 删除对话行

### 修改文件

#### 路由注册
- `qwen3-tts-backend/main.py`
  - 添加 `dialogue` 和 `dialogue_line` 路由

#### 前端路由
- `qwen3-tts-frontend/src/App.tsx`
  - 添加 `/dialogues` 路由（列表页）
  - 添加 `/dialogues/:id` 路由（编辑器页）

#### 导航菜单
- `qwen3-tts-frontend/src/components/Navigation.tsx`
  - 添加"对话管理"菜单项

### API 规格

#### POST /api/dialogues
请求体：
```json
{
  "title": "故事旁白",
  "description": "儿童故事旁白对话",
  "character_ids": ["uuid1", "uuid2"]
}
```

响应：
```json
{
  "id": "uuid",
  "title": "故事旁白",
  "description": "儿童故事旁白对话",
  "character_ids": ["uuid1", "uuid2"],
  "total_lines": 0,
  "generated_lines": 0,
  "total_duration": 0,
  "status": "draft",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### POST /api/dialogues/{id}/lines
请求体：
```json
{
  "character_id": "uuid",
  "text": "你好，欢迎来到我们的节目",
  "order": 0
}
```

响应：
```json
{
  "id": "uuid",
  "dialogue_id": "uuid",
  "character_id": "uuid",
  "text": "你好，欢迎来到我们的节目",
  "order": 0,
  "audio_path": null,
  "duration": null,
  "status": "pending",
  "error_message": null,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 表格编辑器功能详情

#### 基础功能
- 行内编辑：点击单元格直接编辑
- 新增行：点击"添加行"按钮或按 Enter 键
- 删除行：点击删除按钮或按 Delete 键
- 复制行：点击复制按钮或按 Ctrl+D

#### 实时保存
- Debounce 延迟：300ms
- 保存状态指示：
  - "已保存" - 所有更改已保存
  - "保存中..." - 正在保存
  - "未保存" - 有未保存的更改
  - "保存失败" - 保存出错（显示重试按钮）

#### 撤销/重做
- 记录操作类型：创建、更新、删除、排序
- 历史记录上限：20 步
- 快捷键：Ctrl+Z（撤销）、Ctrl+Y（重做）
- 可撤销操作：
  - 创建对话行
  - 更新对话行文本
  - 更新对话行角色
  - 删除对话行
  - 拖拽排序

#### 角色选择器
- 下拉菜单，显示角色头像和名称
- 颜色标识（每个角色用不同颜色）
- 快速添加角色按钮（在下拉菜单底部）

#### 文本输入框
- 多行自动扩展（最大 5 行）
- 字符计数（最大 2000 字符）
- 超出限制时显示警告

### 验收标准

- [ ] 创建对话，选择角色列表
- [ ] 对话列表显示正常，支持搜索和筛选
- [ ] 对话编辑器打开，显示角色选择器和对话行表格
- [ ] 添加对话行，选择角色和输入文本
- [ ] 快捷键功能正常（Enter, Ctrl+D, Delete, Ctrl+Z, Ctrl+Y）
- [ ] 实时保存功能正常（300ms debounce）
- [ ] 保存状态指示器显示正确状态
- [ ] 撤销/重做功能正常（20 步历史）
- [ ] 删除对话时清理关联的音频文件
- [ ] 复制对话功能正常（不复制音频文件）
- [ ] 角色选择器可以快速添加新角色

### 测试命令

```bash
cd qwen3-tts-backend
pytest tests/test_dialogue.py -v
pytest tests/test_dialogue_line.py -v

cd qwen3-tts-frontend
npm run test -- dialogue
```

---

## 阶段 5: 对话生成系统（WebSocket）

**工期**: 4-6天
**目标**: 顺序生成 + 实时进度推送 + 暂停/继续/取消

### 后端新建文件

#### API 端点
- `qwen3-tts-backend/api/dialogue_generation.py`
  - `POST /api/dialogues/{id}/generate` - 开始生成对话
  - `POST /api/dialogues/{id}/generate/pause` - 暂停生成
  - `POST /api/dialogues/{id}/generate/resume` - 继续生成
  - `POST /api/dialogues/{id}/generate/cancel` - 取消生成
  - `POST /api/dialogue-lines/{line_id}/regenerate` - 重新生成单条对话行

#### WebSocket
- `qwen3-tts-backend/api/websocket.py`
  - `WS /api/ws/{user_id}` - WebSocket 连接端点
  - 连接管理：连接、断开、心跳
  - 消息类型：
    - `generation_started` - 生成开始
    - `line_generating` - 正在生成某行
    - `line_completed` - 某行生成完成
    - `line_failed` - 某行生成失败
    - `generation_paused` - 生成暂停
    - `generation_resumed` - 生成继续
    - `generation_completed` - 生成完成
    - `generation_cancelled` - 生成取消
    - `generation_error` - 生成错误

#### 核心处理器
- `qwen3-tts-backend/core/dialogue_processor.py`
  - `DialogueProcessor` 类
  - `start_generation()` - 开始生成任务
  - `pause_generation()` - 暂停生成
  - `resume_generation()` - 继续生成
  - `cancel_generation()` - 取消生成
  - `process_dialogue_lines()` - 顺序处理对话行
  - `generate_single_line()` - 生成单条对话行
  - `send_progress_update()` - 发送 WebSocket 进度消息

#### 工具函数
- `qwen3-tts-backend/utils/tts_helper.py`
  - `generate_line_audio()` - 生成对话行音频
  - `get_character_tts_params()` - 获取角色的 TTS 参数
  - `calculate_audio_duration()` - 计算音频时长

### 前端新建文件

#### Hooks
- `qwen3-tts-frontend/src/hooks/useWebSocket.ts`
  - WebSocket 连接管理
  - 消息订阅和处理
  - 自动重连（最多 5 次，指数退避）
  - 心跳保持（30 秒间隔）

#### 组件
- `qwen3-tts-frontend/src/components/dialogue/GenerationControlPanel.tsx`
  - 生成控制面板
  - 按钮：开始生成、暂停、继续、取消
  - 进度条
  - 状态显示

- `qwen3-tts-frontend/src/components/dialogue/GenerationProgress.tsx`
  - 生成进度组件
  - 总进度条
  - 当前行指示器
  - 统计信息（总数、已完成、失败）

- `qwen3-tts-frontend/src/components/dialogue/LineStatusIndicator.tsx`
  - 对话行状态指示器
  - 状态图标：
    - 待生成：灰色圆圈
    - 生成中：旋转加载图标
    - 已完成：绿色勾选
    - 失败：红色叉号（显示错误信息）
  - 重试按钮（失败时显示）

### 修改文件

#### 后端路由注册
- `qwen3-tts-backend/main.py`
  - 添加 `dialogue_generation` 路由
  - 添加 WebSocket 路由

#### 前端 DialogueEditor
- `qwen3-tts-frontend/src/pages/DialogueEditor.tsx`
  - 集成 `GenerationControlPanel`
  - 集成 WebSocket 连接
  - 监听生成事件，更新对话行状态

#### 前端 DialogueTable
- `qwen3-tts-frontend/src/components/dialogue/DialogueTable.tsx`
  - 添加状态列（显示 `LineStatusIndicator`）
  - 添加操作列（重试按钮）

### WebSocket 消息格式

#### 生成开始
```json
{
  "type": "generation_started",
  "data": {
    "dialogue_id": "uuid",
    "total_lines": 10,
    "started_at": "2024-01-01T00:00:00Z"
  }
}
```

#### 正在生成某行
```json
{
  "type": "line_generating",
  "data": {
    "dialogue_id": "uuid",
    "line_id": "uuid",
    "order": 0,
    "text": "你好，欢迎来到我们的节目",
    "character_name": "小明"
  }
}
```

#### 某行生成完成
```json
{
  "type": "line_completed",
  "data": {
    "dialogue_id": "uuid",
    "line_id": "uuid",
    "order": 0,
    "audio_path": "/outputs/dialogues/uuid/line-0.wav",
    "duration": 3.5
  }
}
```

#### 某行生成失败
```json
{
  "type": "line_failed",
  "data": {
    "dialogue_id": "uuid",
    "line_id": "uuid",
    "order": 0,
    "error_message": "TTS service timeout"
  }
}
```

#### 生成完成
```json
{
  "type": "generation_completed",
  "data": {
    "dialogue_id": "uuid",
    "total_lines": 10,
    "generated_lines": 10,
    "failed_lines": 0,
    "total_duration": 35.2,
    "completed_at": "2024-01-01T00:05:00Z"
  }
}
```

### 生成流程详情

#### 顺序生成逻辑
1. 用户点击"开始生成"按钮
2. 后端创建 `DialogueLineGeneration` 记录
3. 检查是否有其他生成中的对话（同一用户只能有一个生成中的对话）
4. 获取对话的所有未生成行（status = 'pending'）
5. 按 order 排序，顺序处理每一行：
   - 更新行状态为 'generating'
   - 发送 WebSocket 消息 `line_generating`
   - 调用 TTS 服务生成音频
   - 保存音频文件
   - 更新行状态为 'completed'，设置 audio_path 和 duration
   - 发送 WebSocket 消息 `line_completed`
   - 如果生成失败，更新行状态为 'error'，设置 error_message
   - 发送 WebSocket 消息 `line_failed`
6. 所有行处理完成后，发送 WebSocket 消息 `generation_completed`
7. 更新对话状态和统计信息

#### 暂停逻辑
1. 用户点击"暂停"按钮
2. 后端设置生成任务状态为 'paused'
3. 当前行生成完成后，停止处理后续行
4. 发送 WebSocket 消息 `generation_paused`

#### 继续逻辑
1. 用户点击"继续"按钮
2. 后端设置生成任务状态为 'generating'
3. 从上次暂停的位置继续处理
4. 发送 WebSocket 消息 `generation_resumed`

#### 取消逻辑
1. 用户点击"取消"按钮
2. 后端设置生成任务状态为 'cancelled'
3. 当前行生成完成后，停止处理后续行
4. 发送 WebSocket 消息 `generation_cancelled`

#### 单条重试逻辑
1. 用户点击对话行的"重试"按钮
2. 后端删除旧的音频文件（如果存在）
3. 重置行状态为 'pending'
4. 调用 TTS 服务重新生成音频
5. 更新行状态和音频信息
6. 发送 WebSocket 消息 `line_completed` 或 `line_failed`

### 并发控制

#### 用户级并发限制
- 同一用户只能有一个生成中的对话
- 如果尝试开始新的生成任务，返回错误：`409 Conflict`
- 错误信息：`"您已有一个正在生成的对话，请先完成或取消"`

#### 数据库锁
- 使用数据库事务和行锁，防止并发修改
- 使用 `SELECT ... FOR UPDATE` 锁定正在处理的对话行

### WebSocket 连接管理

#### 心跳机制
- 服务器每 30 秒发送 ping 消息
- 客户端收到 ping 后立即回复 pong
- 如果 10 秒内未收到 pong，服务器断开连接

#### 断线重连
- 客户端检测到断开连接后，自动尝试重连
- 重连策略：指数退避（1s, 2s, 4s, 8s, 16s）
- 最多重连 5 次，失败后提示用户手动刷新

#### 连接恢复
- 重连成功后，客户端请求当前对话的生成状态
- 服务器返回最新的进度信息
- 客户端更新 UI，恢复实时进度显示

### 环境变量配置

```bash
# qwen3-tts-backend/.env
DIALOGUES_OUTPUT_DIR=./outputs/dialogues
WEBSOCKET_PING_INTERVAL=30
WEBSOCKET_PING_TIMEOUT=10
```

```python
# qwen3-tts-backend/core/config.py
DIALOGUES_OUTPUT_DIR: str = "./outputs/dialogues"
MAX_DIALOGUE_LINES: int = 200
WEBSOCKET_PING_INTERVAL: int = 30
WEBSOCKET_PING_TIMEOUT: int = 10
```

### 验收标准

- [ ] 点击"开始生成"，WebSocket 连接建立
- [ ] 实时显示生成进度（当前行、进度条、统计信息）
- [ ] 每条对话行顺序生成，状态更新实时显示
- [ ] 暂停功能正常，当前行完成后停止
- [ ] 继续功能正常，从暂停位置继续
- [ ] 取消功能正常，停止生成并保留已生成的音频
- [ ] 单条重试功能正常，重新生成失败的对话行
- [ ] 并发控制生效，同一用户只能有一个生成中的对话
- [ ] WebSocket 断线自动重连（最多 5 次）
- [ ] 重连后恢复进度显示
- [ ] 心跳机制正常工作（30 秒间隔）

### 测试命令

```bash
cd qwen3-tts-backend
pytest tests/test_dialogue_generation.py -v
pytest tests/test_websocket.py -v

cd qwen3-tts-frontend
npm run test -- dialogue-generation
```

---

## 阶段 6: 音频合并和导出

**工期**: 3-5天
**目标**: 智能间隔合并 + 多格式导出（JSON/CSV/SRT/音频 ZIP）

### 后端新建文件

#### API 端点
- `qwen3-tts-backend/api/audio_merge.py`
  - `POST /api/dialogues/{id}/merge` - 合并对话音频（智能间隔）
  - `GET /api/dialogues/{id}/merge/status` - 获取合并任务状态
  - `GET /api/dialogues/{id}/merge/download` - 下载合并后的音频
  - `POST /api/dialogues/{id}/merge/preview` - 预览合并效果（不保存文件）

- `qwen3-tts-backend/api/dialogue_export.py`
  - `POST /api/dialogues/{id}/export/json` - 导出为 JSON
  - `POST /api/dialogues/{id}/export/csv` - 导出为 CSV
  - `POST /api/dialogues/{id}/export/srt` - 导出为 SRT 字幕
  - `POST /api/dialogues/{id}/export/zip` - 导出为 ZIP（所有音频文件）

#### 工具函数
- `qwen3-tts-backend/utils/audio_merger.py`
  - `AudioMerger` 类
  - `merge_dialogue_audio()` - 合并对话音频
  - `calculate_smart_interval()` - 智能计算间隔（基于标点符号、语气）
  - `add_silence()` - 添加静音间隔
  - `normalize_audio()` - 音频归一化

- `qwen3-tts-backend/utils/export_helper.py`
  - `export_to_json()` - 导出为 JSON
  - `export_to_csv()` - 导出为 CSV
  - `export_to_srt()` - 导出为 SRT 字幕
  - `create_audio_zip()` - 创建音频 ZIP 文件

### 前端新建文件

#### 组件
- `qwen3-tts-frontend/src/components/dialogue/AudioMergeDialog.tsx`
  - 音频合并对话框
  - 间隔设置：
    - 默认间隔（秒）
    - 智能间隔开关
    - 间隔倍率（用于调整智能间隔的结果）
  - 归一化音量开关
  - 预览按钮
  - 合并按钮

- `qwen3-tts-frontend/src/components/dialogue/ExportDialog.tsx`
  - 导出对话框
  - 格式选择：JSON, CSV, SRT, 音频 ZIP
  - 选项：
    - 包含音频路径
    - 包含时间戳
    - 包含角色信息
  - 下载按钮

- `qwen3-tts-frontend/src/components/dialogue/AudioPlayer.tsx`
  - 音频播放器
  - 播放/暂停、进度条、音量控制
  - 显示当前时间和总时长
  - 倍速播放（0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x）

### 修改文件

#### 后端路由注册
- `qwen3-tts-backend/main.py`
  - 添加 `audio_merge` 路由
  - 添加 `dialogue_export` 路由

#### 前端 DialogueEditor
- `qwen3-tts-frontend/src/pages/DialogueEditor.tsx`
  - 添加"合并音频"按钮
  - 添加"导出"按钮
  - 显示合并后的音频播放器

### 智能间隔算法

#### 间隔规则
根据对话行末尾的标点符号，自动计算间隔时长：

| 标点符号 | 间隔倍率 | 示例文本 |
|---------|---------|---------|
| 句号（。！？.!?） | 1.0x | "你好。" → 默认间隔 |
| 逗号（，,） | 0.5x | "你好，" → 默认间隔 × 0.5 |
| 分号（；;） | 0.7x | "首先；" → 默认间隔 × 0.7 |
| 冒号（：:） | 0.6x | "如下：" → 默认间隔 × 0.6 |
| 省略号（……...） | 1.5x | "嗯……" → 默认间隔 × 1.5 |
| 破折号（——--） | 1.2x | "但是——" → 默认间隔 × 1.2 |
| 无标点 | 0.3x | "你好" → 默认间隔 × 0.3 |

#### 计算公式
```
实际间隔 = 默认间隔 × 标点倍率 × 用户倍率
```

例如：
- 默认间隔：1.0 秒
- 标点倍率：句号 = 1.0x
- 用户倍率：1.2
- 实际间隔：1.0 × 1.0 × 1.2 = 1.2 秒

#### 特殊规则
- **对话行切换**：如果下一行是不同角色，间隔倍率 × 1.2
- **段落结束**：如果是对话的最后一行，不添加间隔

### API 规格

#### POST /api/dialogues/{id}/merge
请求体：
```json
{
  "default_interval": 1.0,
  "use_smart_interval": true,
  "interval_multiplier": 1.2,
  "normalize_volume": true
}
```

响应：
```json
{
  "task_id": "uuid",
  "status": "processing",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### GET /api/dialogues/{id}/merge/status
响应：
```json
{
  "task_id": "uuid",
  "status": "completed",
  "output_path": "/outputs/dialogues/uuid/merged.wav",
  "duration": 120.5,
  "created_at": "2024-01-01T00:00:00Z",
  "completed_at": "2024-01-01T00:02:00Z"
}
```

#### POST /api/dialogues/{id}/export/json
响应：
```json
{
  "dialogue": {
    "id": "uuid",
    "title": "故事旁白",
    "characters": [...],
    "lines": [
      {
        "order": 0,
        "character": "小明",
        "text": "你好，欢迎来到我们的节目",
        "audio_path": "/outputs/dialogues/uuid/line-0.wav",
        "duration": 3.5,
        "start_time": 0,
        "end_time": 3.5
      },
      ...
    ],
    "total_duration": 120.5
  }
}
```

#### POST /api/dialogues/{id}/export/srt
响应（SRT 字幕文件）：
```
1
00:00:00,000 --> 00:00:03,500
[小明] 你好，欢迎来到我们的节目

2
00:00:04,500 --> 00:00:08,200
[小红] 谢谢，很高兴来到这里

...
```

### 导出格式详情

#### JSON 格式
包含完整的对话信息：
- 对话元数据（标题、描述、创建时间）
- 角色列表（名称、头像、颜色）
- 对话行列表（顺序、角色、文本、音频路径、时长、时间戳）
- 总时长和统计信息

#### CSV 格式
表格格式，适合 Excel 打开：
```
Order,Character,Text,Audio Path,Duration,Start Time,End Time
0,小明,你好欢迎来到我们的节目,/outputs/dialogues/uuid/line-0.wav,3.5,0,3.5
1,小红,谢谢很高兴来到这里,/outputs/dialogues/uuid/line-1.wav,3.7,4.5,8.2
...
```

#### SRT 字幕格式
标准 SRT 字幕文件，可用于视频编辑：
- 时间格式：`HH:MM:SS,mmm`
- 包含角色名称（方括号）
- 按顺序编号

#### 音频 ZIP 格式
包含所有对话行的音频文件：
```
dialogue-uuid.zip
├── line-0.wav (小明)
├── line-1.wav (小红)
├── line-2.wav (小明)
├── ...
└── merged.wav (合并后的音频，如果已合并)
```

### 验收标准

- [ ] 音频合并功能正常，生成合并后的音频文件
- [ ] 智能间隔算法正确计算间隔（基于标点符号）
- [ ] 间隔倍率调整生效
- [ ] 归一化音量功能正常
- [ ] 预览功能可以试听合并效果（不保存文件）
- [ ] 导出为 JSON 格式，包含完整的对话信息
- [ ] 导出为 CSV 格式，可用 Excel 打开
- [ ] 导出为 SRT 字幕，时间戳正确
- [ ] 导出为音频 ZIP，包含所有音频文件
- [ ] 音频播放器功能正常（播放/暂停、进度条、倍速）
- [ ] 下载文件名清晰（包含对话标题和时间戳）

### 测试命令

```bash
cd qwen3-tts-backend
pytest tests/test_audio_merge.py -v
pytest tests/test_dialogue_export.py -v

cd qwen3-tts-frontend
npm run test -- audio-merge
npm run test -- export
```

---

## 阶段 7: UI 优化（虚拟滚动+拖拽+批量）

**工期**: 4-6天
**目标**: 性能优化（1000+ 行流畅渲染）+ 拖拽排序 + 批量生成

### 后端新建文件

#### API 端点
- `qwen3-tts-backend/api/batch_generation.py`
  - `POST /api/dialogues/{id}/generate/batch` - 批量生成（并行模式）
  - `POST /api/dialogues/{id}/regenerate-all` - 重新生成全部对话行
  - `POST /api/dialogues/{id}/regenerate-selected` - 重新生成选中的对话行

#### 核心处理器
- `qwen3-tts-backend/core/batch_dialogue_processor.py`
  - `BatchDialogueProcessor` 类
  - `batch_generate()` - 批量生成（并行处理）
  - `regenerate_all()` - 重新生成全部
  - `regenerate_selected()` - 重新生成选中行
  - 并发池管理（最多 3 个并发 TTS 任务）

### 前端新建文件

#### Hooks
- `qwen3-tts-frontend/src/hooks/useVirtualScroll.ts`
  - 虚拟滚动 hook
  - 基于 `@tanstack/react-virtual`
  - 支持动态行高

#### 组件
- `qwen3-tts-frontend/src/components/dialogue/VirtualDialogueTable.tsx`
  - 虚拟滚动表格组件
  - 性能优化：只渲染可见行（窗口内 + 上下各 5 行）
  - 支持 1000+ 行流畅滚动

- `qwen3-tts-frontend/src/components/dialogue/DragHandle.tsx`
  - 拖拽手柄组件
  - 使用 `react-beautiful-dnd` 实现拖拽排序

- `qwen3-tts-frontend/src/components/dialogue/GenerationModeSelector.tsx`
  - 生成模式选择器
  - 模式：
    - 顺序生成（默认）
    - 批量生成（并行，最多 3 个并发）

- `qwen3-tts-frontend/src/components/dialogue/BatchProgress.tsx`
  - 批量生成进度组件
  - 显示每个并发任务的进度
  - 显示总进度和统计信息

### 修改文件

#### 后端路由注册
- `qwen3-tts-backend/main.py`
  - 添加 `batch_generation` 路由

#### 前端 DialogueTable
- `qwen3-tts-frontend/src/components/dialogue/DialogueTable.tsx`
  - 替换为 `VirtualDialogueTable`（虚拟滚动）
  - 集成拖拽排序功能

#### 前端 GenerationControlPanel
- `qwen3-tts-frontend/src/components/dialogue/GenerationControlPanel.tsx`
  - 添加生成模式选择器
  - 添加"重新生成全部"按钮
  - 添加"重新生成选中"按钮（多选）

#### 前端依赖
- `qwen3-tts-frontend/package.json`
  - 添加 `react-beautiful-dnd` - 拖拽排序
  - 添加 `@tanstack/react-virtual` - 虚拟滚动

### 虚拟滚动实现

#### 核心原理
- 只渲染可见区域的行（窗口内 + 上下各 5 行缓冲）
- 其他行用空白占位（保持滚动条正确）
- 滚动时动态加载/卸载行

#### 性能指标
- 1000 行：60 FPS 流畅滚动
- 5000 行：60 FPS 流畅滚动
- 10000 行：50-60 FPS 滚动

#### 优化技巧
- 使用 `React.memo` 防止不必要的重渲染
- 使用 `useMemo` 缓存计算结果
- 使用 `useCallback` 缓存回调函数
- 延迟加载非关键数据（头像、预览音频）

### 拖拽排序实现

#### 核心功能
- 拖拽手柄：每行左侧显示拖拽图标
- 拖拽反馈：拖拽时显示半透明占位符
- 自动保存：拖拽结束后自动保存新顺序

#### API 调用
拖拽结束后，调用后端 API 更新 order 字段：
```typescript
// 前端代码
const handleDragEnd = async (result) => {
  const { source, destination } = result
  if (!destination) return

  // 重新排序
  const newLines = reorder(lines, source.index, destination.index)

  // 更新 order 字段
  await updateLineOrder(dialogueId, newLines.map(line => line.id))
}
```

### 批量生成模式

#### 顺序生成（默认）
- 按 order 顺序，逐行生成
- 适合需要连贯性的对话（同一角色多次发言）
- 优点：稳定、可预测
- 缺点：速度较慢

#### 批量生成（并行）
- 同时生成多行（最多 3 个并发）
- 适合角色交替发言的对话
- 优点：速度快（约 3 倍）
- 缺点：可能对 TTS 服务造成压力

#### 批量生成流程
1. 用户选择"批量生成"模式
2. 后端创建 3 个并发任务池
3. 从对话行队列中取出 3 行，并行生成
4. 每完成一行，从队列中取下一行
5. 所有行生成完成后，发送完成消息

#### WebSocket 消息（批量模式）
```json
{
  "type": "batch_generation_started",
  "data": {
    "dialogue_id": "uuid",
    "total_lines": 30,
    "concurrent_tasks": 3
  }
}
```

```json
{
  "type": "batch_line_completed",
  "data": {
    "dialogue_id": "uuid",
    "line_id": "uuid",
    "order": 5,
    "task_index": 1,
    "completed_lines": 6,
    "total_lines": 30
  }
}
```

### 重新生成功能

#### 重新生成全部
- 删除所有现有音频文件
- 重置所有行状态为 'pending'
- 重新开始生成任务

#### 重新生成选中行
- 支持多选对话行（Shift + 点击，Ctrl + 点击）
- 删除选中行的音频文件
- 重置选中行状态为 'pending'
- 只生成选中的行

### API 规格

#### POST /api/dialogues/{id}/generate/batch
请求体：
```json
{
  "concurrent_tasks": 3
}
```

响应：
```json
{
  "task_id": "uuid",
  "mode": "batch",
  "concurrent_tasks": 3,
  "total_lines": 30,
  "started_at": "2024-01-01T00:00:00Z"
}
```

#### POST /api/dialogues/{id}/regenerate-selected
请求体：
```json
{
  "line_ids": ["uuid1", "uuid2", "uuid3"]
}
```

响应：
```json
{
  "task_id": "uuid",
  "regenerated_lines": 3,
  "started_at": "2024-01-01T00:00:00Z"
}
```

### 验收标准

- [ ] 虚拟滚动功能正常，1000+ 行流畅渲染（60 FPS）
- [ ] 拖拽排序功能正常，拖拽结束后自动保存
- [ ] 批量生成模式可选，并行生成（最多 3 个并发）
- [ ] 批量生成进度显示正确（多个进度条）
- [ ] 重新生成全部功能正常，删除旧音频并重新生成
- [ ] 重新生成选中功能正常，支持多选（Shift + 点击，Ctrl + 点击）
- [ ] 性能测试通过：
  - 1000 行：首次渲染 < 2 秒
  - 1000 行：滚动帧率 > 55 FPS
  - 5000 行：首次渲染 < 5 秒
  - 5000 行：滚动帧率 > 50 FPS
- [ ] 拖拽时 UI 响应流畅，无卡顿

### 安装依赖

```bash
cd qwen3-tts-frontend
npm install react-beautiful-dnd @tanstack/react-virtual
npm install --save-dev @types/react-beautiful-dnd
```

### 测试命令

```bash
cd qwen3-tts-backend
pytest tests/test_batch_generation.py -v

cd qwen3-tts-frontend
npm run test -- virtual-scroll
npm run test -- drag-drop
npm run test -- batch-generation
```

---

## 阶段 8: 测试和文档

**工期**: 3-4天
**目标**: 完整测试 + 用户文档 + 移动端适配

### 新建文件

#### 后端测试
- `qwen3-tts-backend/tests/test_voice_library.py`
  - 测试音色库 CRUD
  - 测试预览音频生成
  - 测试引用检查

- `qwen3-tts-backend/tests/test_character.py`
  - 测试角色 CRUD
  - 测试音色绑定（三种模式）
  - 测试引用检查

- `qwen3-tts-backend/tests/test_dialogue.py`
  - 测试对话 CRUD
  - 测试对话行 CRUD
  - 测试排序和重新排序

- `qwen3-tts-backend/tests/test_dialogue_generation.py`
  - 测试顺序生成
  - 测试批量生成
  - 测试暂停/继续/取消
  - 测试并发控制

- `qwen3-tts-backend/tests/test_audio_merge.py`
  - 测试音频合并
  - 测试智能间隔算法
  - 测试归一化音量

- `qwen3-tts-backend/tests/test_websocket.py`
  - 测试 WebSocket 连接
  - 测试消息推送
  - 测试心跳和重连

#### 用户文档
- `docs/user-guide.md`
  - 功能概述
  - 音色库管理
  - 角色管理
  - 对话编辑
  - 生成和导出
  - 常见问题

- `docs/api-reference.md`
  - API 端点列表
  - 请求/响应示例
  - WebSocket 消息格式
  - 错误代码

### 修改文件

#### 项目 README
- `README.md`
  - 更新功能说明（添加多人对话功能）
  - 更新安装说明（新的依赖）
  - 更新使用说明（新的 API 端点）

#### 移动端适配
- `qwen3-tts-frontend/src/index.css`
  - 添加移动端媒体查询
  - 调整表格布局（移动端垂直布局）
  - 调整按钮大小（移动端更大的触摸目标）

### 测试清单

#### 功能测试

**音色库管理**
- [ ] 创建音色库，生成预览音频
- [ ] 更新音色库参数，重新生成预览
- [ ] 删除音色库，清理预览音频
- [ ] 删除被引用的音色库（应被阻止）
- [ ] 搜索和分页功能正常

**角色管理**
- [ ] 创建角色（三种音色来源）
- [ ] 头像选择器（图标/上传/首字母）
- [ ] 颜色选择器（预设/自定义）
- [ ] 更新角色信息
- [ ] 删除角色，检查引用
- [ ] 搜索和分页功能正常

**对话编辑**
- [ ] 创建对话，选择角色
- [ ] 添加对话行，选择角色和输入文本
- [ ] 快捷键（Enter, Ctrl+D, Delete, Ctrl+Z, Ctrl+Y）
- [ ] 实时保存（300ms debounce）
- [ ] 撤销/重做（20 步历史）
- [ ] 拖拽排序
- [ ] 删除对话，清理音频文件

**对话生成**
- [ ] 顺序生成（逐行）
- [ ] 批量生成（并行 3 个）
- [ ] 暂停生成
- [ ] 继续生成
- [ ] 取消生成
- [ ] 单条重试
- [ ] 重新生成全部
- [ ] 重新生成选中
- [ ] WebSocket 实时进度
- [ ] 并发控制（同一用户只能有一个生成中的对话）

**音频合并**
- [ ] 合并音频（默认间隔）
- [ ] 智能间隔（基于标点符号）
- [ ] 间隔倍率调整
- [ ] 归一化音量
- [ ] 预览功能

**导出功能**
- [ ] 导出 JSON
- [ ] 导出 CSV
- [ ] 导出 SRT 字幕
- [ ] 导出音频 ZIP

**UI 优化**
- [ ] 虚拟滚动（1000+ 行流畅）
- [ ] 拖拽排序
- [ ] 批量生成进度显示

#### 性能测试

**渲染性能**
- [ ] 1000 行对话：首次渲染 < 2 秒
- [ ] 1000 行对话：滚动帧率 > 55 FPS
- [ ] 5000 行对话：首次渲染 < 5 秒
- [ ] 5000 行对话：滚动帧率 > 50 FPS

**生成性能**
- [ ] 顺序生成 100 行：< 5 分钟
- [ ] 批量生成 100 行：< 2 分钟
- [ ] 并发控制有效（最多 3 个并发任务）

**网络性能**
- [ ] WebSocket 断线重连（5 次以内）
- [ ] WebSocket 心跳正常（30 秒间隔）
- [ ] API 响应时间 < 500ms（95% 请求）

#### 兼容性测试

**浏览器**
- [ ] Chrome/Edge（最新版）
- [ ] Firefox（最新版）
- [ ] Safari（最新版）

**设备**
- [ ] 桌面端（1920x1080）
- [ ] 平板端（768x1024）
- [ ] 移动端（375x667）

#### 安全测试

**权限验证**
- [ ] 所有 API 端点验证用户登录
- [ ] 用户只能访问自己的资源
- [ ] 跨用户访问被阻止

**输入验证**
- [ ] 文本长度限制（2000 字符）
- [ ] 对话行数限制（200 行）
- [ ] 文件大小限制（上传头像 2MB）

**错误处理**
- [ ] TTS 服务超时（重试机制）
- [ ] 数据库连接失败（错误提示）
- [ ] WebSocket 断开（自动重连）

### API 测试覆盖率目标

- 总覆盖率：> 80%
- 核心功能（生成、合并）：> 90%
- CRUD 操作：> 85%
- WebSocket 消息：> 75%

### 用户文档结构

#### user-guide.md

```markdown
# Qwen3-TTS 多人对话功能用户指南

## 1. 功能概述
- 多角色对话生成
- 音色库和角色管理
- 实时生成和进度监控
- 智能音频合并
- 多格式导出

## 2. 音色库管理
- 创建音色库
- 设置 TTS 参数
- 生成预览音频
- 删除和引用检查

## 3. 角色管理
- 创建角色
- 选择头像和颜色
- 绑定音色（三种模式）
- 测试音色

## 4. 对话编辑
- 创建对话
- 添加对话行
- 快捷键操作
- 撤销/重做
- 拖拽排序

## 5. 生成和导出
- 顺序生成
- 批量生成
- 暂停/继续/取消
- 单条重试
- 音频合并
- 多格式导出

## 6. 常见问题
- 生成失败怎么办？
- 如何调整音色参数？
- 如何优化生成速度？
- 如何处理长对话（1000+ 行）？
```

#### api-reference.md

```markdown
# Qwen3-TTS 多人对话功能 API 参考

## 音色库 API
- POST /api/voice-library
- GET /api/voice-library
- GET /api/voice-library/{id}
- PATCH /api/voice-library/{id}
- DELETE /api/voice-library/{id}
- ...

## 角色 API
- POST /api/characters
- GET /api/characters
- ...

## 对话 API
- POST /api/dialogues
- GET /api/dialogues
- ...

## WebSocket 消息格式
- generation_started
- line_completed
- ...

## 错误代码
- 400 Bad Request
- 401 Unauthorized
- 409 Conflict
- ...
```

### 移动端适配要点

#### 响应式布局
- 桌面端：表格布局（多列）
- 平板端：紧凑表格（隐藏部分列）
- 移动端：卡片布局（垂直堆叠）

#### 触摸优化
- 按钮最小尺寸：44x44 像素
- 增加行间距（移动端）
- 滑动操作（删除行）

#### 性能优化
- 移动端默认显示 20 行（减少渲染压力）
- 懒加载头像和预览音频
- 减少动画效果

### 验收标准

- [ ] API 测试覆盖率 > 80%
- [ ] 所有功能测试通过
- [ ] 性能测试通过
- [ ] 移动端布局正常（375px 宽度）
- [ ] 用户文档完整，包含截图
- [ ] API 文档完整，包含请求/响应示例
- [ ] README 更新，包含新功能说明

### 测试命令

```bash
# 后端测试
cd qwen3-tts-backend
pytest --cov=. --cov-report=html tests/

# 前端测试
cd qwen3-tts-frontend
npm run test -- --coverage

# E2E 测试
npm run test:e2e

# 性能测试
npm run test:performance
```

---

## 附录

### 开发顺序建议

1. **阶段 1-3**：数据层和基础 CRUD（可后端前端并行）
2. **阶段 4-5**：核心功能（对话编辑 + 生成系统，顺序开发）
3. **阶段 6-7**：增强功能（合并导出 + UI 优化，可并行）
4. **阶段 8**：测试和文档（所有功能完成后）

### 技术难点和注意事项

#### 数据一致性
- 对话行 order 字段保持连续（删除后重新排序）
- 外键约束和级联删除
- 并发修改的事务隔离

#### 文件清理
- 删除对话时清理音频文件
- 删除对话行时清理音频文件
- 更新音色库时清理旧的预览音频

#### WebSocket 稳定性
- 心跳机制（30 秒间隔）
- 断线重连（指数退避，最多 5 次）
- 连接恢复后同步状态

#### 性能优化
- 虚拟滚动（只渲染可见行）
- React.memo 和 useMemo（防止不必要的重渲染）
- 懒加载（头像、预览音频）

#### 并发控制
- 同一用户只能有一个生成中的对话
- 批量生成最多 3 个并发任务
- 数据库行锁（SELECT ... FOR UPDATE）

### 环境变量配置总览

```bash
# qwen3-tts-backend/.env
VOICE_LIBRARY_OUTPUT_DIR=./outputs/voice-library
DIALOGUES_OUTPUT_DIR=./outputs/dialogues
MAX_DIALOGUE_LINES=200
WEBSOCKET_PING_INTERVAL=30
WEBSOCKET_PING_TIMEOUT=10
MAX_CONCURRENT_TTS_TASKS=3
```

### 数据库索引优化

```sql
-- VoiceLibrary 表
CREATE INDEX idx_voice_library_user_id ON voice_library(user_id);
CREATE INDEX idx_voice_library_name ON voice_library(name);

-- Character 表
CREATE INDEX idx_character_user_id ON characters(user_id);
CREATE INDEX idx_character_name ON characters(name);
CREATE INDEX idx_character_voice_library_id ON characters(voice_library_id);

-- Dialogue 表
CREATE INDEX idx_dialogue_user_id ON dialogues(user_id);
CREATE INDEX idx_dialogue_status ON dialogues(status);
CREATE INDEX idx_dialogue_created_at ON dialogues(created_at);

-- DialogueLine 表
CREATE UNIQUE INDEX idx_dialogue_line_order ON dialogue_lines(dialogue_id, order);
CREATE INDEX idx_dialogue_line_character_id ON dialogue_lines(character_id);

-- DialogueLineGeneration 表
CREATE INDEX idx_generation_dialogue_id ON dialogue_line_generations(dialogue_id);
CREATE INDEX idx_generation_status ON dialogue_line_generations(status);
```

### 预计工作量总结

| 阶段 | 工期 | 关键交付物 |
|-----|------|-----------|
| 阶段 1 | 3-5天 | 5 个数据模型 + CRUD |
| 阶段 2 | 3-5天 | 音色库管理（7 个 API + 前端） |
| 阶段 3 | 3-5天 | 角色管理（5 个 API + 前端） |
| 阶段 4 | 3-5天 | 对话编辑器（10 个 API + 前端） |
| 阶段 5 | 4-6天 | 生成系统（WebSocket + 实时进度） |
| 阶段 6 | 3-5天 | 合并导出（8 个 API + 前端） |
| 阶段 7 | 4-6天 | UI 优化（虚拟滚动 + 拖拽 + 批量） |
| 阶段 8 | 3-4天 | 测试和文档（80% 覆盖率） |
| **总计** | **26-45天** | **5-9 周** |

### 里程碑检查点

**Milestone 1**（阶段 1-3 完成）：
- 数据层完整，音色库和角色管理可用
- 用户可以创建音色库和角色

**Milestone 2**（阶段 4-5 完成）：
- 对话编辑和生成系统可用
- 用户可以创建对话并生成音频

**Milestone 3**（阶段 6-7 完成）：
- 完整功能可用
- 用户可以合并音频和导出

**Milestone 4**（阶段 8 完成）：
- 生产就绪
- 文档完整，测试通过
