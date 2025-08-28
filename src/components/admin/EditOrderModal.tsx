"use client";

import {useEffect, useState} from 'react';
import {PhoneNumber, Organization} from '@prisma/client';
import {ENUM_TRANSLATIONS, FIELD_TRANSLATIONS} from '@/lib/utils';

// 扩展类型定义以包含关联的组织信息
type PhoneNumberWithOrganizations = PhoneNumber & {
    school?: Organization | null;
    department?: Organization | null;
};

interface EditOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    numberData: PhoneNumberWithOrganizations | null;
    onSave: (id: string, updatedData: Partial<PhoneNumber>) => Promise<void>;
}

// 定义不需要在表单中编辑的字段
const EXCLUDED_FIELDS = ['id', 'createdAt', 'updatedAt', 'school', 'department'];
// 定义只读字段（显示但不可编辑）
const READONLY_FIELDS = ['schoolId', 'departmentId', 'phoneNumber'];

export const EditOrderModal = ({isOpen, onClose, numberData, onSave}: EditOrderModalProps) => {
    const [formData, setFormData] = useState<Partial<PhoneNumber>>({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (numberData) setFormData(numberData);
    }, [numberData]);

    if (!isOpen || !numberData) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const {name, value, type} = e.target;

        let processedValue: string | number | boolean | null = value;
        if (type === 'checkbox') {
            processedValue = (e.target as HTMLInputElement).checked;
        } else if (value === '') {
            processedValue = null;
        } else if (name === 'paymentAmount') {
            processedValue = parseFloat(value) || null;
        }

        setFormData(prev => ({...prev, [name]: processedValue}));
    };

    // 获取字段显示值
    const getDisplayValue = (key: string, value: unknown): string => {
        // 处理学校和院系字段，显示实际名称
        if (key === 'schoolId' && numberData.school) {
            return numberData.school.name;
        }
        if (key === 'departmentId' && numberData.department) {
            return numberData.department.name;
        }
        
        if (value === null || value === undefined) {
            return '';
        }
        
        // 处理日期
        if (value instanceof Date) {
            return value.toISOString().slice(0, 16); // 格式化为 datetime-local 输入格式
        }
        
        return String(value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        
        // 创建一个新的对象，只包含PhoneNumber的有效字段
        const cleanedData: Partial<PhoneNumber> = {};
        
        // 只复制PhoneNumber类型中存在的字段
        Object.keys(formData).forEach(key => {
            if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && 
                key !== 'school' && key !== 'department') {
                const value = formData[key as keyof typeof formData];
                if (value !== undefined) {
                    (cleanedData as Record<string, unknown>)[key] = value;
                }
            }
        });
        
        // 确保日期字段格式正确
        if (cleanedData.orderTimestamp && typeof cleanedData.orderTimestamp === 'string') {
            cleanedData.orderTimestamp = new Date(cleanedData.orderTimestamp);
        }
        
        await onSave(numberData.id, cleanedData);
        setIsLoading(false);
        onClose();
    };

    // 动态生成表单字段
    const renderFormField = (key: string, value: string | number | boolean | null) => {
        const label = FIELD_TRANSLATIONS[key] || key;
        const isReadonly = READONLY_FIELDS.includes(key);
        const displayValue = getDisplayValue(key, value);

        // 根据字段名选择不同的输入类型
        if (key === 'isPremium') {
            return (
                <div key={key} className="md:col-span-2 flex items-center">
                    <input 
                        type="checkbox" 
                        name={key} 
                        id={key} 
                        checked={!!value} 
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor={key} className="ml-2 block text-sm font-medium text-gray-700">{label}</label>
                </div>
            );
        }

        if (key === 'reservationStatus' || key === 'paymentMethod' || key === 'deliveryStatus') {
            const enumOptions = ENUM_TRANSLATIONS[key.charAt(0).toUpperCase() + key.slice(1) as keyof typeof ENUM_TRANSLATIONS];
            return (
                <div key={key}>
                    <label htmlFor={key} className="block text-sm font-medium text-gray-700">{label}</label>
                    <select 
                        name={key} 
                        id={key} 
                        value={value?.toString() || ''} 
                        onChange={handleChange}
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                    >
                        <option value="">未指定</option>
                        {Object.entries(enumOptions).map(([enumKey, enumValue]) => 
                            <option key={enumKey} value={enumKey}>{enumValue}</option>
                        )}
                    </select>
                </div>
            );
        }

        // 处理日期时间字段
        if (key === 'orderTimestamp') {
            return (
                <div key={key}>
                    <label htmlFor={key} className="block text-sm font-medium text-gray-700">{label}</label>
                    <input
                        type="datetime-local"
                        name={key}
                        id={key}
                        value={displayValue}
                        onChange={handleChange}
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                    />
                </div>
            );
        }

        return (
            <div key={key}>
                <label htmlFor={key} className="block text-sm font-medium text-gray-700">{label}</label>
                <input
                    type={typeof value === 'number' ? 'number' : 'text'}
                    name={key}
                    id={key}
                    value={displayValue}
                    onChange={handleChange}
                    readOnly={isReadonly}
                    className={`mt-1 w-full p-2 border border-gray-300 rounded-md ${
                        isReadonly ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                    }`}
                    placeholder={isReadonly ? '不可编辑' : ''}
                />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div
                className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-in fade-in-90 slide-in-from-bottom-10 duration-500">
                <button onClick={onClose}
                        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                <h2 className="text-2xl font-bold mb-4">编辑订单: {numberData.phoneNumber}</h2>

                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(formData)
                            .filter(([key]) => !EXCLUDED_FIELDS.includes(key))
                            .map(([key, value]) => renderFormField(key, value instanceof Date ? value.toISOString() : value))
                        }
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button type="button" onClick={onClose}
                                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 mr-3">
                            取消
                        </button>
                        <button type="submit" disabled={isLoading}
                                className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300">
                            {isLoading ? '保存中...' : '保存更改'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
