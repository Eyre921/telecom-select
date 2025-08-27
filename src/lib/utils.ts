import {DeliveryStatus, PaymentMethod, ReservationStatus, Role, OrgType} from '@prisma/client';

// 用于将英文字段名翻译为中文，以便在UI中显示
export const FIELD_TRANSLATIONS: { [key: string]: string } = {
    phoneNumber: '手机号码',
    isPremium: '是否靓号',
    premiumReason: '靓号原因',
    reservationStatus: '预定状态',
    orderTimestamp: '下单时间',
    paymentAmount: '收款金额',
    paymentMethod: '支付方式',
    transactionId: '交易订单号',
    assignedMarketer: '工作人员',
    customerName: '客户姓名',
    customerContact: '客户联系方式',
    shippingAddress: '客户收货地址',
    deliveryStatus: '物流状态',
    emsTrackingNumber: 'EMS单号',
    createdAt: '记录创建时间',
    updatedAt: '记录更新时间',
    // 新增组织相关字段（这些字段确实存在于 PhoneNumber 模型中）
    schoolId: '所属学校',
    departmentId: '所属院系',
    // 移除以下不属于 PhoneNumber 模型的字段：
    // role: '用户角色',
    // orgType: '组织类型',
    // name: '组织名称',
    // parentId: '上级组织',
    // organizations: '关联组织',
};

// 用于将英文枚举值翻译为中文
export const ENUM_TRANSLATIONS: { [key: string]: { [key: string]: string } } = {
    ReservationStatus: {
        [ReservationStatus.UNRESERVED]: '未预定',
        [ReservationStatus.PENDING_REVIEW]: '审核中',
        [ReservationStatus.RESERVED]: '已预定',
    },
    PaymentMethod: {
        [PaymentMethod.WECHAT]: '微信',
        [PaymentMethod.ALIPAY]: '支付宝',
        [PaymentMethod.CASH]: '现金',
        [PaymentMethod.OTHER]: '其它',
    },
    DeliveryStatus: {
        [DeliveryStatus.EMPTY]: '空',
        [DeliveryStatus.IN_TRANSIT_UNACTIVATED]: '在途未激活',
        [DeliveryStatus.IN_TRANSIT_ACTIVATED]: '在途已激活',
        [DeliveryStatus.RECEIVED_UNACTIVATED]: '已收到未激活',
    },
    // 新增角色枚举翻译
    Role: {
        [Role.SUPER_ADMIN]: '超级管理员',
        [Role.SCHOOL_ADMIN]: '学校管理员',
        [Role.MARKETER]: '营销人员',
    },
    // 新增组织类型枚举翻译
    OrgType: {
        [OrgType.SCHOOL]: '学校',
        [OrgType.DEPARTMENT]: '院系',
    }
};