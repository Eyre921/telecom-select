import NextAuth from 'next-auth';
import {authOptions} from '@/lib/auth'; // 从新的、唯一的配置文件导入

// 这个文件现在变得非常简洁和稳定
const handler = NextAuth(authOptions);

export {handler as GET, handler as POST};
