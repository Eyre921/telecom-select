'use client';

import {useState} from 'react';
import Link from 'next/link';

type ImportFormat = 'table1' | 'table2' | 'custom';

// 可用字段定义
const AVAILABLE_FIELDS = [
    { key: 'phoneNumber', label: '号码', required: true },
    { key: 'reservationStatus', label: '预定状态', required: false },
    { key: 'paymentAmount', label: '收款金额', required: false },
    { key: 'customerName', label: '客户姓名', required: false },
    { key: 'assignedMarketer', label: '工作人员', required: false },
    { key: 'customerContact', label: '客户联系方式', required: false },
    { key: 'shippingAddress', label: '邮寄地址', required: false },
    { key: 'emsTrackingNumber', label: 'EMS单号', required: false },
    { key: 'paymentMethod', label: '付款方式', required: false },
    { key: 'transactionId', label: '交易单号', required: false }
];

interface SelectedField {
    key: string;
    label: string;
    required: boolean;
}

// 增强的反馈消息组件，支持详细日志显示
function FeedbackMessage({message, type, detailedLog}: { 
    message: string; 
    type: 'success' | 'error' | ''; 
    detailedLog?: string[];
}) {
    const [showDetails, setShowDetails] = useState(false);
    
    if (!message) return null;
    
    const baseClasses = 'mt-4 rounded-md p-4 text-sm';
    const typeClasses = {
        success: 'bg-green-100 text-green-800 border border-green-200',
        error: 'bg-red-100 text-red-800 border border-red-200',
    };
    
    return (
        <div className={`${baseClasses} ${type === 'success' ? typeClasses.success : typeClasses.error}`}>
            <div className="flex items-start justify-between">
                <p className="flex-1">{message}</p>
                {detailedLog && detailedLog.length > 0 && (
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="ml-4 text-xs font-medium underline hover:no-underline focus:outline-none"
                    >
                        {showDetails ? '隐藏详情' : '查看详情'}
                    </button>
                )}
            </div>
            
            {showDetails && detailedLog && detailedLog.length > 0 && (
                <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                    <div className="text-xs font-medium mb-2">📋 详细导入日志：</div>
                    <div className="max-h-60 overflow-y-auto bg-white bg-opacity-50 rounded p-3 font-mono text-xs space-y-1">
                        {detailedLog.map((log, index) => (
                            <div key={index} className="flex items-start space-x-2">
                                <span className="text-gray-500 min-w-[2rem]">{index + 1}.</span>
                                <span className="flex-1">{log}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// 字段选择组件
function FieldSelector({ 
    selectedFields, 
    onFieldsChange 
}: { 
    selectedFields: SelectedField[], 
    onFieldsChange: (fields: SelectedField[]) => void 
}) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const addField = (field: typeof AVAILABLE_FIELDS[0]) => {
        if (!selectedFields.find(f => f.key === field.key)) {
            onFieldsChange([...selectedFields, field]);
        }
    };

    const removeField = (index: number) => {
        const field = selectedFields[index];
        if (!field.required) {
            onFieldsChange(selectedFields.filter((_, i) => i !== index));
        }
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null) return;

        const newFields = [...selectedFields];
        const draggedField = newFields[draggedIndex];
        newFields.splice(draggedIndex, 1);
        newFields.splice(dropIndex, 0, draggedField);
        
        onFieldsChange(newFields);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const availableFields = AVAILABLE_FIELDS.filter(
        field => !selectedFields.find(f => f.key === field.key)
    );

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">可选字段</h3>
                <div className="flex flex-wrap gap-2">
                    {availableFields.map(field => (
                        <button
                            key={field.key}
                            onClick={() => addField(field)}
                            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 transition-colors"
                        >
                            + {field.label}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                    已选字段 (拖拽排序，导入时按此顺序)
                </h3>
                <div className="space-y-2 min-h-[100px] p-3 border-2 border-dashed border-gray-300 rounded-md">
                    {selectedFields.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">请选择需要导入的字段</p>
                    ) : (
                        selectedFields.map((field, index) => (
                            <div
                                key={field.key}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`
                                    flex items-center justify-between p-2 bg-white border rounded-md cursor-move
                                    ${draggedIndex === index ? 'opacity-50' : ''}
                                    ${dragOverIndex === index ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}
                                    hover:border-gray-400 transition-colors
                                `}
                            >
                                <div className="flex items-center space-x-2">
                                    <span className="text-gray-400">⋮⋮</span>
                                    <span className="text-sm font-medium">{index + 1}.</span>
                                    <span className="text-sm">{field.label}</span>
                                    {field.required && (
                                        <span className="text-xs text-red-500">(必需)</span>
                                    )}
                                </div>
                                {!field.required && (
                                    <button
                                        onClick={() => removeField(index)}
                                        className="text-red-500 hover:text-red-700 text-sm"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {selectedFields.length > 0 && (
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    <strong>导入格式预览：</strong> {selectedFields.map(f => f.label).join(' → ')}
                </div>
            )}
        </div>
    );
}

export default function ImportPage() {
    const [data, setData] = useState('');
    const [format, setFormat] = useState<ImportFormat>('table1');
    const [feedback, setFeedback] = useState<{message: string; type: 'success' | 'error' | ''; detailedLog?: string[]}>({message: '', type: ''});
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFields, setSelectedFields] = useState<SelectedField[]>([
        { key: 'phoneNumber', label: '号码', required: true }
    ]);

    const handleImport = async () => {
        setFeedback({message: '', type: ''});
        if (!data.trim()) {
            setFeedback({message: '请输入需要导入的数据！', type: 'error'});
            return;
        }
        
        if (format === 'custom' && selectedFields.length === 0) {
            setFeedback({message: '请至少选择一个字段！', type: 'error'});
            return;
        }
        
        setIsLoading(true);
        try {
            const requestBody = {
                text: data,
                type: format,
                customFields: format === 'custom' ? selectedFields.map(f => f.key) : undefined
            };
            
            const response = await fetch('/api/admin/import-data', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(requestBody),
            });
            const result = await response.json();
            if (!response.ok) {
                // 处理字段数量不足的详细错误信息
                if (result.details && Array.isArray(result.details)) {
                    // details 已经是格式化好的字符串数组，直接使用
                    const detailsText = result.details.join('\n');
                    const errorMessage = `${result.error}\n\n详细信息：\n${detailsText}`;
                    throw new Error(errorMessage);
                }
                throw new Error(result.error || '导入失败，请检查数据格式或联系管理员。');
            }
            
            const successMessage = `🎉 导入完成！新增 ${result.createdCount || 0} 条，更新 ${result.updatedCount || 0} 条，跳过 ${result.skippedCount || 0} 条记录。`;
            
            setFeedback({
                message: successMessage, 
                type: 'success',
                detailedLog: result.updateLog || []
            });
            setData('');
        } catch (error: unknown) {
            console.error('Import failed:', error);
            const errorMessage = error instanceof Error ? error.message : '发生未知错误，导入失败。';
            setFeedback({message: errorMessage, type: 'error'});
        } finally {
            setIsLoading(false);
        }
    };

    const handleDataChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (feedback.message) {
            setFeedback({message: '', type: ''});
        }
        setData(e.target.value);
    };

    function getPlaceholderText(importType: string, customFields?: string[]): string {
        if (importType === 'custom' && customFields) {
            const headers = customFields.map(field => AVAILABLE_FIELDS.find(f => f.key === field)?.label || field).join('\t');
            
            // 为每个字段生成示例数据
            const generateSampleRow = (rowIndex: number) => {
                return customFields.map(fieldKey => {
                    switch (fieldKey) {
                        case 'phoneNumber':
                            return `1380013800${rowIndex}`;
                        case 'reservationStatus':
                            return rowIndex === 1 ? '已预定' : rowIndex === 2 ? '未预定' : '已预定';
                        case 'paymentAmount':
                            return rowIndex === 2 ? '' : (rowIndex === 1 ? '200' : '50');
                        case 'customerName':
                            return rowIndex === 1 ? '张三' : rowIndex === 2 ? '' : '王五';
                        case 'assignedMarketer':
                            return rowIndex === 1 ? '李经理' : rowIndex === 2 ? '' : '赵经理';
                        case 'customerContact':
                            return `1390013900${rowIndex}`;
                        case 'shippingAddress':
                            return rowIndex === 2 ? '' : `示例市示例区示例街道${rowIndex}号`;
                        case 'emsTrackingNumber':
                            return rowIndex === 2 ? '' : `123456789012${rowIndex}`;
                        case 'paymentMethod':
                            return rowIndex === 1 ? '支付宝' : rowIndex === 2 ? '' : '微信';
                        case 'transactionId':
                            return rowIndex === 2 ? '' : `TXN${rowIndex}234567890`;
                        default:
                            return '';
                    }
                }).join('\t');
            };
            
            const sampleRows = [
                generateSampleRow(1),
                generateSampleRow(2),
                generateSampleRow(3)
            ];
            
            return `${headers}\n${sampleRows.join('\n')}`;
        } else if (importType === 'table1') {
            return `号码\t状态\t金额\t客户姓名\t工作人员\n13800138001\t已预定\t全款200\t张三\t李经理\n13800138002\t已预定\t全款200\t李四\t王经理\n13800138003\t\t\t\t\n13800138004\t已预定\t定金20\t王五\t李经理\n13800138005\t已预定\t定金20\t赵六\t张经理`;
        } else if (importType === 'table2') {
            return `序号\t客户姓名\t新选号码\t新选号码序号\t联系号码\t邮寄地址\t快递单号\n1\t张三\t13800138001\t001\t13900139001\t北京市朝阳区示例街道1号\t1234567890123\n2\t李四\t13800138002\t002\t13900139002\t上海市浦东新区示例路2号\t1234567890124\n3\t王五\t13800138003\t003\t13900139003\t广州市天河区示例大道3号\t1234567890125`;
        }
        return '';
    }

    return (
        <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4 sm:p-12">
            <div className="w-full max-w-6xl rounded-lg bg-white p-6 shadow-md sm:p-10">
                <div className="text-center mb-4 relative">
                    <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                        批量导入/更新数据
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        请选择数据格式，自定义字段顺序，然后将表格数据粘贴到文本框中。<br/>
                        <span className="text-indigo-600 font-medium">✨ 系统会自动识别是否包含表头</span>
                    </p>
                    <Link href="/admin/dashboard"
                          className="absolute top-0 right-0 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
                        &larr; 返回仪表盘
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 左侧：格式选择和字段配置 */}
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">请选择导入的数据格式</label>
                            <fieldset className="space-y-2">
                                <div className="flex items-center">
                                    <input id="table1" value="table1" name="import-format" type="radio"
                                           checked={format === 'table1'}
                                           onChange={(e) => setFormat(e.target.value as ImportFormat)}
                                           className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                                    <label htmlFor="table1" className="ml-3 block text-sm font-medium text-gray-700">格式一 (号码基础信息)</label>
                                </div>
                                <div className="flex items-center">
                                    <input id="table2" value="table2" name="import-format" type="radio"
                                           checked={format === 'table2'}
                                           onChange={(e) => setFormat(e.target.value as ImportFormat)}
                                           className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                                    <label htmlFor="table2" className="ml-3 block text-sm font-medium text-gray-700">格式二 (邮寄发货信息)</label>
                                </div>
                                <div className="flex items-center">
                                    <input id="custom" value="custom" name="import-format" type="radio"
                                           checked={format === 'custom'}
                                           onChange={(e) => setFormat(e.target.value as ImportFormat)}
                                           className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                                    <label htmlFor="custom" className="ml-3 block text-sm font-medium text-gray-700">自定义格式 (选择字段和顺序)</label>
                                </div>
                            </fieldset>
                        </div>

                        {format === 'custom' && (
                            <div className="border-t pt-4">
                                <FieldSelector 
                                    selectedFields={selectedFields}
                                    onFieldsChange={setSelectedFields}
                                />
                                
                                <div className="mt-4 p-3 bg-blue-50 rounded-md">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-blue-600">🤖</span>
                                        <span className="text-sm text-blue-800 font-medium">智能表头识别</span>
                                    </div>
                                    <p className="text-xs text-blue-700 mt-1">
                                        系统会自动检测第一行是否为表头。如果号码列包含有效手机号，则视为数据行；否则视为表头行。
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 右侧：数据输入 */}
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="data-import" className="block text-sm font-medium text-gray-700 mb-2">
                                数据导入文本框
                            </label>
                            <textarea
                                id="data-import"
                                name="data"
                                rows={20}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
                                placeholder={getPlaceholderText(format, format === 'custom' ? selectedFields.map(f => f.key) : undefined)}
                                value={data}
                                onChange={handleDataChange}
                                disabled={isLoading}
                            />
                        </div>

                        <FeedbackMessage 
                            message={feedback.message} 
                            type={feedback.type}
                            detailedLog={feedback.detailedLog}
                        />

                        <button
                            type="button"
                            onClick={handleImport}
                            disabled={isLoading || (format === 'custom' && selectedFields.length === 0)}
                            className="w-full rounded-md border border-transparent bg-indigo-600 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-400"
                        >
                            {isLoading ? '正在导入中...' : '开始导入'}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
