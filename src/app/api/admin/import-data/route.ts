import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '@/lib/auth';
import prisma from '@/lib/prisma';
import {PhoneNumber, ReservationStatus, PaymentMethod} from '@prisma/client';

// 字段映射定义
const FIELD_MAPPINGS = {
    phoneNumber: { key: 'phoneNumber', parser: (value: string) => value.trim() },
    reservationStatus: { 
        key: 'reservationStatus', 
        parser: (value: string) => {
            const v = value.toLowerCase();
            if (v.includes('已预定') || v.includes('已交付')) return ReservationStatus.RESERVED;
            if (v.includes('审核')) return ReservationStatus.PENDING_REVIEW;
            return ReservationStatus.UNRESERVED;
        }
    },
    paymentAmount: { 
        key: 'paymentAmount', 
        parser: (value: string) => {
            const match = value.match(/\d+(\.\d+)?/);
            return match ? parseFloat(match[0]) : null;
        }
    },
    customerName: { key: 'customerName', parser: (value: string) => value.trim() || null },
    assignedMarketer: { key: 'assignedMarketer', parser: (value: string) => value.trim() || null },
    customerContact: { key: 'customerContact', parser: (value: string) => value.trim() || null },
    shippingAddress: { key: 'shippingAddress', parser: (value: string) => value.trim() || null },
    emsTrackingNumber: { key: 'emsTrackingNumber', parser: (value: string) => value.trim() || null },
    paymentMethod: {
        key: 'paymentMethod',
        parser: (value: string) => {
            const v = value.toLowerCase();
            if (v.includes('微信') || v.includes('wechat')) return PaymentMethod.WECHAT;
            if (v.includes('支付宝') || v.includes('alipay')) return PaymentMethod.ALIPAY;
            if (v.includes('现金') || v.includes('cash')) return PaymentMethod.CASH;
            return PaymentMethod.OTHER;
        }
    },
    transactionId: { key: 'transactionId', parser: (value: string) => value.trim() || null }
};

// 智能识别表头函数
// function detectHeader(lines: string[], fieldKeys?: string[]): boolean {
//     if (lines.length === 0) return false;
    
//     const firstLine = lines[0].trim();
//     const parts = firstLine.split('\t').map(p => p.trim());
    
//     // 如果是自定义格式，检查第一列是否为有效手机号
//     if (fieldKeys && fieldKeys[0] === 'phoneNumber') {
//         const firstColumn = parts[0];
//         // 如果第一列不是有效手机号，很可能是表头
//         if (!/^1[3-9]\d{9}$/.test(firstColumn)) {
//             return true;
//         }
//         return false;
//     }
    
//     // 对于预设格式，使用原有的关键词检测
//     const lowerFirstLine = firstLine.toLowerCase();
//     if (lowerFirstLine.includes('号码') || lowerFirstLine.includes('姓名') || lowerFirstLine.includes('序号')) {
//         return true;
//     }
    
//     // 额外检查：如果第一行包含明显的表头关键词
//     const headerKeywords = ['客户', '工作人员', '地址', '金额', '状态', '联系', '单号'];
//     if (headerKeywords.some(keyword => lowerFirstLine.includes(keyword))) {
//         return true;
//     }
    
//     return false;
// }

// 靓号分析算法
function analyzeNumber(numberStr: string): { isPremium: boolean; reason: string | null } {
    if (!numberStr || numberStr.length < 2) return {isPremium: false, reason: null};
    const checks = [
        {pattern: /(\d)\1{3,}/, reason: '超级豹子号'}, {pattern: /8888/, reason: '发发发发'},
        {pattern: /6666/, reason: '六六大顺'}, {pattern: /9999/, reason: '天长地久'},
        {pattern: /518518/, reason: '我要发'}, {pattern: /168168/, reason: '一路发'},
        {pattern: /520/, reason: '我爱你'}, {pattern: /1314/, reason: '一生一世'},
        {pattern: /518/, reason: '我要发'}, {pattern: /168/, reason: '一路发'},
        {pattern: /668/, reason: '路路发'}, {pattern: /(\d)\1(\d)\2/, reason: 'AABB型'},
        {pattern: /(\d)(\d)\1\2/, reason: 'ABAB型'}, {pattern: /(\d)\1{2}/, reason: '豹子号'},
        {pattern: /(012|123|234|345|456|567|678|789)/, reason: '顺子号'},
        {pattern: /(987|876|765|654|543|432|321|210)/, reason: '倒顺子'},
        {pattern: /88$/, reason: '双发'}, {pattern: /66$/, reason: '双顺'},
        {pattern: /99$/, reason: '长久'}, {pattern: /8$/, reason: '发'}, {pattern: /6$/, reason: '顺'},
    ];
    for (const check of checks) {
        if (check.pattern.test(numberStr)) return {isPremium: true, reason: check.reason};
    }
    return {isPremium: false, reason: null};
}

// 自定义字段解析器
function parseCustomFormat(line: string, fieldKeys: string[]): Partial<PhoneNumber> | null {
    const parts = line.split('\t');
    if (parts.length < fieldKeys.length) {
        return null;
    }

    const result: Record<string, unknown> = {};
    
    fieldKeys.forEach((key, index) => {
        if (index < parts.length && FIELD_MAPPINGS[key as keyof typeof FIELD_MAPPINGS]) {
            const mapping = FIELD_MAPPINGS[key as keyof typeof FIELD_MAPPINGS];
            const value = parts[index]?.trim();
            if (value && mapping) {
                result[mapping.key] = mapping.parser(value);
            }
        }
    });

    const data: Partial<PhoneNumber> = {};
    
    for (let i = 0; i < fieldKeys.length && i < parts.length; i++) {
        const fieldKey = fieldKeys[i];
        const value = parts[i];
        
        if (!value) continue;
        
        const mapping = FIELD_MAPPINGS[fieldKey as keyof typeof FIELD_MAPPINGS];
        if (mapping) {
            const parsedValue = mapping.parser(value);
            if (parsedValue !== null && parsedValue !== undefined) {
                (data as Record<string, unknown>)[mapping.key] = parsedValue;
            }
        }
    }
    
    // 验证必需字段
    if (!data.phoneNumber || !/^1[3-9]\d{9}$/.test(data.phoneNumber)) {
        return null;
    }
    
    return data;
}

function parseTable1(line: string): Partial<PhoneNumber> | null {
    const parts = line.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 1) return null;

    const phoneNumber = parts[0];
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) return null;

    const data: Partial<PhoneNumber> = {phoneNumber};

    if (parts.length === 1) {
        data.reservationStatus = ReservationStatus.UNRESERVED;
        return data;
    }

    const statusPart = parts[1];
    if (statusPart) {
        if (statusPart.includes('已预定') || statusPart.includes('已交付')) data.reservationStatus = ReservationStatus.RESERVED;
        else if (statusPart.includes('审核')) data.reservationStatus = ReservationStatus.PENDING_REVIEW;
        else data.reservationStatus = ReservationStatus.UNRESERVED;
    } else {
        data.reservationStatus = ReservationStatus.UNRESERVED;
    }

    const amountPart = parts[2];
    if (amountPart) {
        const amountMatch = amountPart.match(/\d+/);
        data.paymentAmount = amountMatch ? parseFloat(amountMatch[0]) : null;
    }

    if (parts[3]) data.customerName = parts[3];
    if (parts[4]) data.assignedMarketer = parts[4];

    return data;
}

// 新增：智能数据行分割函数，基于手机号码识别行边界
function smartSplitDataLines(text: string): string[] {
    // 手机号码正则表达式
    const phoneRegex = /1[3-9]\d{9}/g;
    const lines: string[] = [];
    
    // 将所有换行符统一为\n，然后按行分割
    const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    
    let currentLine = '';
    
    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i].trim();
        if (!line) continue; // 跳过空行
        
        // 如果当前行包含手机号码，且currentLine不为空，说明上一条记录结束
        if (phoneRegex.test(line) && currentLine) {
            lines.push(currentLine.trim());
            currentLine = line;
        } else if (phoneRegex.test(line)) {
            // 新记录开始
            currentLine = line;
        } else if (currentLine) {
            // 继续拼接到当前记录（处理地址换行的情况）
            currentLine += ' ' + line;
        }
        
        // 重置正则表达式的lastIndex
        phoneRegex.lastIndex = 0;
    }
    
    // 添加最后一条记录
    if (currentLine.trim()) {
        lines.push(currentLine.trim());
    }
    
    return lines;
}

// 修改parseTable2函数，更智能地处理字段分割
function parseTable2(line: string): Partial<PhoneNumber> | null {
    // 首先尝试标准的制表符分割
    let parts = line.split('\t').map(p => p.trim());
    
    // 如果制表符分割结果不足7个字段，尝试智能分割
    if (parts.length < 7) {
        // 使用正则表达式找到手机号码位置
        const phoneRegex = /1[3-9]\d{9}/g;
        const phoneMatches = [];
        let match;
        
        while ((match = phoneRegex.exec(line)) !== null) {
            phoneMatches.push({
                phone: match[0],
                index: match.index
            });
        }
        
        if (phoneMatches.length >= 1) {
            // 找到主要的手机号码（通常是第一个或最长的）
            const mainPhone = phoneMatches[0];
            
            // 基于手机号码位置重新分割字段
            const beforePhone = line.substring(0, mainPhone.index).trim();
            const afterPhone = line.substring(mainPhone.index + 11).trim();
            
            // 重新构建parts数组
            const beforeParts = beforePhone.split(/\s+|\t+/).filter(p => p.trim());
            const afterParts = afterPhone.split(/\s+|\t+/).filter(p => p.trim());
            
            // 重新组织字段：序号、客户姓名、新选号码、新选号码序号、联系号码、邮寄地址、快递单号
            parts = [];
            
            // 序号（通常是第一个数字）
            if (beforeParts.length > 0 && /^\d+$/.test(beforeParts[0])) {
                parts[0] = beforeParts[0];
                parts[1] = beforeParts.slice(1).join(' '); // 客户姓名
            } else {
                parts[0] = ''; // 序号
                parts[1] = beforeParts.join(' '); // 客户姓名
            }
            
            parts[2] = mainPhone.phone; // 新选号码
            
            // 处理后续字段
            if (afterParts.length > 0) {
                // 寻找联系号码（第二个手机号）
                let contactPhoneIndex = -1;
                for (let i = 0; i < afterParts.length; i++) {
                    if (/^1[3-9]\d{9}$/.test(afterParts[i])) {
                        contactPhoneIndex = i;
                        break;
                    }
                }
                
                if (contactPhoneIndex >= 0) {
                    parts[3] = afterParts.slice(0, contactPhoneIndex).join(' '); // 新选号码序号
                    parts[4] = afterParts[contactPhoneIndex]; // 联系号码
                    
                    // 剩余部分分为地址和快递单号
                    const remaining = afterParts.slice(contactPhoneIndex + 1);
                    if (remaining.length > 0) {
                        // 最后一个可能是快递单号（通常是数字字母组合）
                        const lastPart = remaining[remaining.length - 1];
                        if (/^[A-Z0-9]{10,}$/i.test(lastPart)) {
                            parts[5] = remaining.slice(0, -1).join(' '); // 邮寄地址
                            parts[6] = lastPart; // 快递单号
                        } else {
                            parts[5] = remaining.join(' '); // 全部作为邮寄地址
                            parts[6] = ''; // 快递单号
                        }
                    } else {
                        parts[5] = ''; // 邮寄地址
                        parts[6] = ''; // 快递单号
                    }
                } else {
                    // 没有找到联系号码
                    parts[3] = ''; // 新选号码序号
                    parts[4] = ''; // 联系号码
                    parts[5] = afterParts.join(' '); // 全部作为邮寄地址
                    parts[6] = ''; // 快递单号
                }
            } else {
                parts[3] = parts[4] = parts[5] = parts[6] = '';
            }
        }
    }
    
    // 格式二期望：序号\t客户姓名\t新选号码\t新选号码序号\t联系号码\t邮寄地址\t快递单号
    if (parts.length < 3) return null; // 至少需要序号、姓名、号码
    
    const phoneNumber = parts[2]; // 第3列是新选号码
    if (!phoneNumber || !/^1[3-9]\d{9}$/.test(phoneNumber)) return null;
    
    const data: Partial<PhoneNumber> = { phoneNumber };
    
    // 客户姓名 (第2列)
    if (parts[1] && parts[1].trim()) {
        data.customerName = parts[1].trim();
    }
    
    // 联系号码 (第5列)
    if (parts[4] && parts[4].trim() && /^1[3-9]\d{9}$/.test(parts[4].trim())) {
        data.customerContact = parts[4].trim();
    }
    
    // 邮寄地址 (第6列)
    if (parts[5] && parts[5].trim()) {
        data.shippingAddress = parts[5].trim();
    }
    
    // EMS单号 (第7列)
    if (parts[6] && parts[6].trim()) {
        data.emsTrackingNumber = parts[6].trim();
    }
    
    return data;
}

// 字段标签映射，用于生成更友好的日志
const FIELD_LABELS: Record<string, string> = {
    phoneNumber: '号码',
    reservationStatus: '预定状态',
    paymentAmount: '收款金额',
    customerName: '客户姓名',
    assignedMarketer: '工作人员',
    customerContact: '客户联系方式',
    shippingAddress: '邮寄地址',
    emsTrackingNumber: 'EMS单号',
    paymentMethod: '付款方式',
    transactionId: '交易单号',
    isPremium: '靓号状态',
    premiumReason: '靓号原因'
};

// 格式化字段值显示
function formatFieldValue(key: string, value: unknown): string {
    if (value === null || value === undefined) {
        return '空';
    }
    
    switch (key) {
        case 'reservationStatus':
            return value === 'RESERVED' ? '已预定' : '未预定';
        case 'paymentMethod':
            switch (value) {
                case 'CASH': return '现金';
                case 'ALIPAY': return '支付宝';
                case 'WECHAT': return '微信';
                case 'BANK_TRANSFER': return '银行转账';
                default: return String(value);
            }
        case 'isPremium':
            return value ? '是' : '否';
        case 'paymentAmount':
            return `¥${value}`;
        default:
            return String(value);
    }
}

// 智能识别表头函数
// 新增智能数据起始行识别函数
function findDataStartLine(lines: string[], type: string, customFields?: string[]): { startIndex: number; hasHeader: boolean; error?: string } {
    if (lines.length === 0) return { startIndex: 0, hasHeader: false };
    
    // 定义预设格式的期望字段数量
    const expectedFieldCounts = {
        table1: 5, // 号码、状态、金额、客户姓名、工作人员
        table2: 7, // 序号、客户姓名、号码、序号、联系号码、地址、快递单号
        custom: customFields?.length || 0
    };
    
    const expectedCount = expectedFieldCounts[type as keyof typeof expectedFieldCounts] || 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
        
        // 检查是否为表头行（包含关键词）
        const lowerLine = line.toLowerCase();
        const isHeaderLine = lowerLine.includes('号码') || lowerLine.includes('姓名') || 
                           lowerLine.includes('序号') || lowerLine.includes('客户') || 
                           lowerLine.includes('工作人员') || lowerLine.includes('地址') || 
                           lowerLine.includes('金额') || lowerLine.includes('状态') || 
                           lowerLine.includes('联系') || lowerLine.includes('单号');
        
        if (isHeaderLine) {
            // 找到表头，验证字段数量
            if (expectedCount > 0 && parts.length !== expectedCount) {
                return {
                    startIndex: i,
                    hasHeader: true,
                    error: `表头字段数量不匹配！期望 ${expectedCount} 个字段，实际 ${parts.length} 个字段。请检查数据格式是否正确。`
                };
            }
            return { startIndex: i, hasHeader: true };
        }
        
        // 检查是否为数据行（第一列包含手机号或序号）
        const firstCol = parts[0];
        const isDataLine = /^1[3-9]\d{9}$/.test(firstCol) || // 手机号
                          /^\d{1,4}$/.test(firstCol) || // 序号
                          (type === 'custom' && customFields?.[0] === 'phoneNumber' && /^1[3-9]\d{9}$/.test(firstCol));
        
        if (isDataLine) {
            // 找到数据行，验证字段数量
            if (expectedCount > 0 && parts.length !== expectedCount) {
                return {
                    startIndex: i,
                    hasHeader: false,
                    error: `数据字段数量不匹配！期望 ${expectedCount} 个字段，实际 ${parts.length} 个字段。请检查数据格式：\n${getFormatExample(type)}`
                };
            }
            return { startIndex: i, hasHeader: false };
        }
    }
    
    return { startIndex: 0, hasHeader: false, error: '未找到有效的数据行，请检查数据格式是否正确。' };
}

// 获取格式示例
function getFormatExample(type: string): string {
    switch (type) {
        case 'table1':
            return '格式一示例：号码\t状态\t金额\t客户姓名\t工作人员';
        case 'table2':
            return '格式二示例：序号\t客户姓名\t号码\t序号\t联系号码\t地址\t快递单号';
        default:
            return '请确保数据格式与选择的导入类型匹配。';
    }
}

// 添加字段验证函数
function validateFieldCounts(lines: string[], type: string, customFields?: string[], forceImport?: boolean): {
    isValid: boolean;
    insufficientLines: string[];
    excessiveLines: { line: string; lineNumber: number; actualCount: number; expectedCount: number }[];
    expectedCount: number;
} {
    const expectedFieldCounts = {
        table1: 5, // 号码、状态、金额、客户姓名、工作人员
        table2: 7, // 序号、客户姓名、号码、序号、联系号码、地址、快递单号
        custom: customFields?.length || 0
    };
    
    const expectedCount = expectedFieldCounts[type as keyof typeof expectedFieldCounts] || 0;
    const insufficientLines: string[] = [];
    const excessiveLines: { line: string; lineNumber: number; actualCount: number; expectedCount: number }[] = [];
    
    lines.forEach((line, index) => {
        const parts = line.split('\t').map(p => p.trim());
        const actualCount = parts.length;
        
        if (actualCount < expectedCount) {
            insufficientLines.push(`第${index + 1}行: ${line} (缺少${expectedCount - actualCount}个字段)`);
        } else if (actualCount > expectedCount && !forceImport) {
            excessiveLines.push({
                line,
                lineNumber: index + 1,
                actualCount,
                expectedCount
            });
        }
    });
    
    const isValid = insufficientLines.length === 0 && (forceImport || excessiveLines.length === 0);
    
    return {
        isValid,
        insufficientLines,
        excessiveLines,
        expectedCount
    };
}

// 修改POST函数
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({error: '权限不足'}, {status: 403});
    }

    try {
        const body = await request.json();
        const {text, type, customFields, forceImport = false} = body;

        if (!text) return NextResponse.json({error: '导入内容不能为空'}, {status: 400});

        // 使用智能分割函数处理数据
        const lines = type === 'table2' ? smartSplitDataLines(text) : 
                     text.split('\n').filter((line: string) => line.trim() !== '');
                     
        if (lines.length === 0) return NextResponse.json({createdCount: 0, updatedCount: 0, skippedCount: 0});

        // 智能识别数据起始行
        const { startIndex, hasHeader, error } = findDataStartLine(lines, type, customFields);
        
        if (error) {
            return NextResponse.json({error}, {status: 400});
        }
        
        const dataLines = hasHeader ? lines.slice(startIndex + 1) : lines.slice(startIndex);
        
        if (hasHeader && dataLines.length === 0) {
            return NextResponse.json({error: '表头后没有找到有效的数据行'}, {status: 400});
        }

        // 验证字段数量
        const validation = validateFieldCounts(dataLines, type, customFields, forceImport);
        
        // 如果有字段不足的行，直接拒绝导入
        if (validation.insufficientLines.length > 0) {
            return NextResponse.json({
                error: '数据格式错误：以下行字段数量不足',
                details: validation.insufficientLines,
                expectedCount: validation.expectedCount
            }, {status: 400});
        }
        
        // 如果有字段过多的行且未强制导入，返回确认信息
        if (validation.excessiveLines.length > 0 && !forceImport) {
            const displayLines = validation.excessiveLines.slice(0, 5); // 只显示前5行
            return NextResponse.json({
                needConfirmation: true,
                message: `发现 ${validation.excessiveLines.length} 行数据字段数量超出预期`,
                excessiveLines: displayLines,
                totalExcessiveCount: validation.excessiveLines.length,
                expectedCount: validation.expectedCount
            }, {status: 200});
        }

        // 继续原有的导入逻辑...
        let skippedCount = 0;
        const upsertPromises = [];
        const updateLog: string[] = [];
        
        // 添加数据识别日志
        if (startIndex > 0) {
            updateLog.push(`🔍 跳过前 ${startIndex} 行非数据内容`);
        }
        if (hasHeader) {
            updateLog.push(`📋 识别到表头: ${lines[startIndex]}`);
        }
        if (forceImport && validation.excessiveLines.length > 0) {
            updateLog.push(`⚠️ 强制导入模式：已截断 ${validation.excessiveLines.length} 行的多余字段`);
        }
        updateLog.push(`📊 开始处理 ${dataLines.length} 行数据`);

        for (const line of dataLines) {
            let parsedData: Partial<PhoneNumber> | null = null;
            
            // 如果是强制导入模式，截断多余字段
            let processLine = line;
            if (forceImport) {
                const parts = line.split('\t').map((p: string) => p.trim());
                if (parts.length > validation.expectedCount) {
                    processLine = parts.slice(0, validation.expectedCount).join('\t');
                }
            }
            
            if (type === 'custom' && customFields) {
                parsedData = parseCustomFormat(processLine, customFields);
            } else if (type === 'table1') {
                parsedData = parseTable1(processLine);
            } else if (type === 'table2') {
                parsedData = parseTable2(processLine);
            }

            if (!parsedData || !parsedData.phoneNumber) {
                skippedCount++;
                continue;
            }

            const {isPremium, reason} = analyzeNumber(parsedData.phoneNumber);
            const finalData = {...parsedData, isPremium, premiumReason: reason};

            // 检查现有记录
            const existingRecord = await prisma.phoneNumber.findUnique({
                where: { phoneNumber: finalData.phoneNumber }
            });

            if (existingRecord) {
                // 记录将要更新的字段，包含更详细的信息
                const updatedFields: string[] = [];
                const recordInfo: string[] = [];
                
                Object.entries(finalData).forEach(([key, value]) => {
                    if (value !== null && value !== undefined && (existingRecord as Record<string, unknown>)[key] !== value) {
                        const fieldLabel = FIELD_LABELS[key] || key;
                        const oldValue = formatFieldValue(key, (existingRecord as Record<string, unknown>)[key]);
                        const newValue = formatFieldValue(key, value);
                        updatedFields.push(`${fieldLabel}: ${oldValue} → ${newValue}`);
                    }
                });
                
                // 添加记录的基本信息
                if (finalData.customerName) recordInfo.push(`客户: ${finalData.customerName}`);
                if (finalData.customerContact) recordInfo.push(`联系: ${finalData.customerContact}`);
                if (finalData.assignedMarketer) recordInfo.push(`工作人员: ${finalData.assignedMarketer}`);
                
                if (updatedFields.length > 0) {
                    const basicInfo = recordInfo.length > 0 ? ` [${recordInfo.join(', ')}]` : '';
                    updateLog.push(`📝 更新 ${finalData.phoneNumber}${basicInfo}: ${updatedFields.join(', ')}`);
                } else {
                    const basicInfo = recordInfo.length > 0 ? ` [${recordInfo.join(', ')}]` : '';
                    updateLog.push(`⏭️ 跳过 ${finalData.phoneNumber}${basicInfo}: 数据无变化`);
                }
            } else {
                // 新增记录的详细信息
                const recordInfo: string[] = [];
                if (finalData.customerName) recordInfo.push(`客户: ${finalData.customerName}`);
                if (finalData.customerContact) recordInfo.push(`联系: ${finalData.customerContact}`);
                if (finalData.assignedMarketer) recordInfo.push(`工作人员: ${finalData.assignedMarketer}`);
                if (finalData.paymentAmount) recordInfo.push(`金额: ¥${finalData.paymentAmount}`);
                if (finalData.isPremium) recordInfo.push(`靓号: ${finalData.premiumReason || '是'}`);
                
                const basicInfo = recordInfo.length > 0 ? ` [${recordInfo.join(', ')}]` : '';
                updateLog.push(`✨ 新增 ${finalData.phoneNumber}${basicInfo}`);
            }

            const upsertPromise = prisma.phoneNumber.upsert({
                where: {phoneNumber: finalData.phoneNumber},
                create: finalData as Omit<PhoneNumber, 'id' | 'createdAt' | 'updatedAt'>,
                update: Object.fromEntries(
                    Object.entries(finalData).filter(([, v]) => v !== null && v !== undefined)
                ),
            });
            upsertPromises.push(upsertPromise);
        }

        if (upsertPromises.length === 0) {
            return NextResponse.json({createdCount: 0, updatedCount: 0, skippedCount, updateLog});
        }

        const results = await prisma.$transaction(upsertPromises);
        const updatedCount = results.filter(r => r.createdAt.getTime() !== r.updatedAt.getTime()).length;
        const createdCount = results.length - updatedCount;

        return NextResponse.json({createdCount, updatedCount, skippedCount, updateLog});

    } catch (error: unknown) {
        console.error('[ADMIN_IMPORT_DATA_API_ERROR]', error);
        return NextResponse.json({error: '服务器内部错误'}, {status: 500});
    }
}
