// 建议添加全局错误边界
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>系统发生错误</h2>
        <button onClick={() => reset()}>重试</button>
      </body>
    </html>
  );
}