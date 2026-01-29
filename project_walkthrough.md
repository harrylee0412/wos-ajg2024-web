# WoS Query Generator Web App - Walkthrough

## 🎯 目标实现

已成功将原有的 Python 脚本工具转化为现代化的 Next.js Web 应用程序。

### 主要变更

1. **架构升级**: 从单一 Python 脚本升级为 Next.js (React) 前后端分离架构（静态数据驱动）。
2. **数据整合**: 编写了 `generate_data.py` 脚本，自动合并 `期刊分类表FMS+ABS.xlsx` (FMS/ABS等级) 和 `AJG2024.xlsx` (FT50/UTD24信息)。
3. **功能增强**:
    - 新增 **FMS 2025** 等级筛选。
    - 新增 **自定义关键词** 输入功能，自动生成完整检索式。
    - 提供了直观的 Web 交互界面。

## 📸 功能展示

### 1. 核心界面

Web 应用包含左侧的筛选面板和右侧的检索式生成区。

- **筛选器**:
  - **Special Collections**: FT50, UTD24 (复选框)
  - **ABS Rankings**: 4*, 4, 3, 2, 1 (多选)
  - **FMS Rankings**: Level A, B, C, D (多选)
  - **Fields**: 动态提取的所有学科领域 (多选)

- **检索生成**:
  - 输入关键词后，检索式会自动更新为:

    ```
    (IS=(xxxx-xxxx OR yyyy-yyyy) AND TS=("your keyword"))
    ```

### 2. 部署与运行

项目位于 `wos_query_tool` 目录下。

**启动开发服务器**:

```bash
cd wos_query_tool
npm run dev
```

**构建生产版本**:

```bash
npm run build
npm start
```

## 📄 文件清单

- `generate_data.py`: 数据处理脚本。
- `wos_query_tool/public/journals.json`: 生成的期刊数据文件。
- `wos_query_tool/app/page.tsx`: 核心前端逻辑。
- `README.md`: 更新后的项目文档。
