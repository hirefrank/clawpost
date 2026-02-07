import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { Database } from "./schema";

export function getDb(d1: D1Database): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new D1Dialect({ database: d1 }),
  });
}
