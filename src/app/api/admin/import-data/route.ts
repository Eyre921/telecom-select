import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '@/lib/auth'; // **关键修复**: 从正确的 @/lib/auth 路径导入
import prisma from '@/lib/prisma';
import {PhoneNumber, ReservationStatus} from '@prisma/client';

// --- 更新后的靓号分析算法 ---
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

// --- 数据解析函数 (保持不变) ---
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

function parseTable2(line: string): Partial<PhoneNumber> | null {
    const phoneNumbers = line.match(/1[3-9]\d{9}/g);
    if (!phoneNumbers || phoneNumbers.length === 0) return null;

    const phoneNumber = phoneNumbers[0];
    const customerContact = phoneNumbers.length > 1 ? phoneNumbers[1] : null;

    const data: Partial<PhoneNumber> = {phoneNumber};
    if (customerContact) data.customerContact = customerContact;

    const trackingNumberMatch = line.match(/[A-Za-z0-9]{10,}/g);
    if (trackingNumberMatch) {
        const potentialTracking = trackingNumberMatch.filter(n => !n.startsWith('1') && n.length > 10);
        if (potentialTracking.length > 0) data.emsTrackingNumber = potentialTracking.pop();
    }

    let remainingLine = line.replace(phoneNumber, '').replace(customerContact || '', '').replace(data.emsTrackingNumber || '', '');
    const parts = remainingLine.trim().split(/\s+/).filter(Boolean);

    if (/^\d{1,4}$/.test(parts[0])) parts.shift();
    if (/^\d{1,4}$/.test(parts[1]) && parts[0].length >= 2) parts.splice(1, 1);

    const name = parts.find(p => p.length >= 2 && p.length <= 4 && !/\d/.test(p));
    if (name) data.customerName = name;

    const address = parts.filter(p => p !== name).join(' ');
    if (address) data.shippingAddress = address;

    return data;
}


// --- 主API路由 ---
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({error: '权限不足'}, {status: 403});
    }

    try {
        const body = await request.json();
        const {text, type} = body;

        if (!text) return NextResponse.json({error: '导入内容不能为空'}, {status: 400});

        const lines = text.split('\n').filter((line: string) => line.trim() !== '');
        if (lines.length === 0) return NextResponse.json({createdCount: 0, updatedCount: 0, skippedCount: 0});

        const firstLine = lines[0].toLowerCase();
        if (firstLine.includes('号码') || firstLine.includes('姓名') || firstLine.includes('序号')) {
            lines.shift();
        }

        let skippedCount = 0;
        const upsertPromises = [];

        for (const line of lines) {
            let parsedData: Partial<PhoneNumber> | null = null;
            if (type === 'table1') parsedData = parseTable1(line);
            else if (type === 'table2') parsedData = parseTable2(line);

            if (!parsedData || !parsedData.phoneNumber) {
                skippedCount++;
                continue;
            }

            const {isPremium, reason} = analyzeNumber(parsedData.phoneNumber);
            const finalData = {...parsedData, isPremium, premiumReason: reason};

            const upsertPromise = prisma.phoneNumber.upsert({
                where: {phoneNumber: finalData.phoneNumber},
                create: finalData as any, // Use 'any' to bypass strict type checking for create
                update: Object.fromEntries(Object.entries(finalData).filter(([_, v]) => v !== null && v !== undefined)),
            });
            upsertPromises.push(upsertPromise);
        }

        if (upsertPromises.length === 0) return NextResponse.json({createdCount: 0, updatedCount: 0, skippedCount});

        const results = await prisma.$transaction(upsertPromises);
        const updatedCount = results.filter(r => r.createdAt.getTime() !== r.updatedAt.getTime()).length;
        const createdCount = results.length - updatedCount;

        return NextResponse.json({createdCount, updatedCount, skippedCount});

    } catch (error) {
        console.error('[ADMIN_IMPORT_DATA_API_ERROR]', error);
        return NextResponse.json({error: '服务器内部错误'}, {status: 500});
    }
}
