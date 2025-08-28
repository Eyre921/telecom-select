import {PrismaClient} from '@prisma/client';

declare global {
    var prisma: PrismaClient | undefined;
}

const client = globalThis.prisma || new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=1&pool_timeout=20&socket_timeout=20'
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// SQLite 性能优化
if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = client;
} else {
  // 生产环境优化
  client.$executeRaw`PRAGMA journal_mode=WAL;`;
  client.$executeRaw`PRAGMA synchronous=NORMAL;`;
  client.$executeRaw`PRAGMA cache_size=10000;`;
  client.$executeRaw`PRAGMA temp_store=memory;`;
}

export default client;
