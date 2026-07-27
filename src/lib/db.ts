import mongoose from 'mongoose';

type Cached = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Runtime-safe global cache
const g = global as unknown as { _mongoose?: Cached };
if (!g._mongoose) {
  g._mongoose = { conn: null, promise: null };
}
const cached: Cached = g._mongoose;

async function connect() {
  if (cached.conn) {
    return cached.conn;
  }

  const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local or .env');
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connect;
export { mongoose };
