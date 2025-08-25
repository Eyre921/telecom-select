import Image from 'next/image';

// 示例修复后的代码结构
try {
    // ... existing code ...
} catch (err: unknown) {
    console.error('Error:', err);
    // 移除未使用的 errorMessage 变量，直接处理错误
    // 处理错误逻辑
}

// 将 img 标签替换为 next/image
<Image 
    src="/path/to/image.jpg" 
    alt="描述" 
    width={100} 
    height={100}
    className="your-classes"
/>