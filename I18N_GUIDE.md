# i18n 国际化使用指南

## 概述

本项目已集成 i18next 和 react-i18next，支持中文和英文两种语言。

## 文件结构

```
src/
├── i18n/
│   ├── config.ts          # i18n 配置文件
│   └── locales/
│       ├── zh.json        # 中文翻译
│       └── en.json        # 英文翻译
├── main.tsx               # 引入 i18n 配置
└── App.tsx                # 使用 i18n 的组件
```

## 功能特性

1. **默认语言**: 中文 (zh)
2. **备用语言**: 英文 (en)
3. **语言切换**: 点击页面右上角的语言切换按钮
4. **持久化**: 可以扩展添加 localStorage 来保存用户的语言偏好

## 使用方法

### 在组件中使用翻译

```typescript
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t, i18n } = useTranslation()
  
  // 使用翻译
  return <h1>{t('app.title')}</h1>
  
  // 切换语言
  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
  }
}
```

### 添加新的翻译

1. 在 `src/i18n/locales/zh.json` 中添加中文翻译
2. 在 `src/i18n/locales/en.json` 中添加对应的英文翻译

例如：

```json
// zh.json
{
  "newFeature": {
    "title": "新功能",
    "description": "这是一个新功能"
  }
}

// en.json
{
  "newFeature": {
    "title": "New Feature",
    "description": "This is a new feature"
  }
}
```

### 在代码中使用

```typescript
<h1>{t('newFeature.title')}</h1>
<p>{t('newFeature.description')}</p>
```

## 当前支持的翻译键

- `app.title` - 应用标题
- `app.footer` - 页脚文本
- `features.*` - 功能相关翻译
- `ui.*` - UI 元素翻译
- `quality.*` - 质量选项翻译
- `status.*` - 状态消息翻译
- `language.*` - 语言相关翻译

## 扩展建议

1. **添加语言持久化**:
```typescript
// 在 config.ts 中添加
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const savedLanguage = localStorage.getItem('language') || 'zh'

i18n
  .use(initReactI18next)
  .init({
    lng: savedLanguage,
    // ... 其他配置
  })

// 保存语言选择
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng)
})
```

2. **添加更多语言**: 在 `locales` 文件夹中创建新的 JSON 文件，并在 `config.ts` 中注册

3. **使用命名空间**: 对于大型应用，可以将翻译拆分为多个命名空间

## 依赖包

- `i18next`: 核心国际化框架
- `react-i18next`: React 集成库

