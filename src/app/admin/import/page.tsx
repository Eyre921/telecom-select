'use client';

import { useState } from 'react';

type ImportFormat = 'table1' | 'table2';

function FeedbackMessage({ message, type }: { message: string; type: 'success' | 'error' | '' }) {
    if (!message) return null;
    const baseClasses = 'mt-4 rounded-md p-4 text-sm';
    const typeClasses = {
        success: 'bg-green-100 text-green-800',
        error: 'bg-red-100 text-red-800',
    };
    return (
        <div className={`${baseClasses} ${type === 'success' ? typeClasses.success : typeClasses.error}`}>
            <p>{message}</p>
        </div>
    );
}

export default function ImportPage() {
    const [data, setData] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState({ message: '', type: '' as 'success' | 'error' | '' });
    const [format, setFormat] = useState<ImportFormat>('table1');

    const handleImport = async () => {
        setFeedback({ message: '', type: '' });
        if (!data.trim()) {
            setFeedback({ message: '请输入需要导入的数据！', type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/import-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: data, type: format }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || '导入失败，请检查数据格式或联系管理员。');
            }
            const successMessage = `导入完成！新增 ${result.createdCount || 0} 条，更新 ${result.updatedCount || 0} 条，跳过 ${result.skippedCount || 0} 条。`;
            setFeedback({ message: successMessage, type: 'success' });
            setData('');
        } catch (error: any) {
            console.error('Import failed:', error);
            setFeedback({ message: error.message || '发生未知错误，导入失败。', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDataChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (feedback.message) {
            setFeedback({ message: '', type: '' });
        }
        setData(e.target.value);
    };

    return (
        <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4 sm:p-12">
            <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-md sm:p-10">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                        批量导入/更新数据
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        请选择正确的数据格式，然后将表格数据粘贴到文本框中。
                    </p>
                </div>

                <div className="mt-8">
                    <label className="block text-sm font-medium text-gray-700 mb-2">请选择导入的数据格式</label>
                    <fieldset className="flex space-x-4">
                        <div className="flex items-center">
                            <input id="table1" value="table1" name="import-format" type="radio" checked={format === 'table1'} onChange={(e) => setFormat(e.target.value as ImportFormat)} className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                            <label htmlFor="table1" className="ml-3 block text-sm font-medium text-gray-700">格式一 (号码基础信息)</label>
                        </div>
                        <div className="flex items-center">
                            <input id="table2" value="table2" name="import-format" type="radio" checked={format === 'table2'} onChange={(e) => setFormat(e.target.value as ImportFormat)} className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                            <label htmlFor="table2" className="ml-3 block text-sm font-medium text-gray-700">格式二 (邮寄发货信息)</label>
                        </div>
                    </fieldset>
                </div>

                <div className="mt-4">
                    <label htmlFor="data-import" className="sr-only">
                        数据导入文本框
                    </label>
                    <textarea
                        id="data-import"
                        name="data"
                        rows={15}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
                        placeholder={
                            format === 'table1'
                                ? "格式一示例 (从Excel直接复制，可带表头):\n号码\t卡板状态\t收款金额\t客户姓名\t工作人员\n19067192804\t已预定\t全款200\t罗焱阳\t符航康\n19067192843"
                                : "格式二示例 (从Excel直接复制，可带表头):\n序号\t客户姓名\t新选号码\t...\n1\t张乐怡\t19067172615\t...\t湖南省长沙市雨花区..."
                        }
                        value={data}
                        onChange={handleDataChange}
                        disabled={isLoading}
                    />
                </div>

                <FeedbackMessage message={feedback.message} type={feedback.type} />

                <div className="mt-6">
                    <button
                        type="button"
                        onClick={handleImport}
                        disabled={isLoading}
                        className="w-full rounded-md border border-transparent bg-indigo-600 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-400"
                    >
                        {isLoading ? '正在导入中...' : '开始导入'}
                    </button>
                </div>
            </div>
        </main>
    );
}
