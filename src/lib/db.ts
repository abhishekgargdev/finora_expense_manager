import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

type Cached = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoose?: Cached;
}

const cached: Cached = global._mongoose ?? { conn: null, promise: null };

if (!cached) global._mongoose = cached;

async function connect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI!).then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connect;
export { mongoose };
