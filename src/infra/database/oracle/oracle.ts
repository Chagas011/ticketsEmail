import { env } from "@/shared/config/env";
import oracledb from "oracledb";

let initialized = false;

export function initializeOracle() {
  if (initialized) {
    return;
  }

  oracledb.initOracleClient({
    libDir: env.ORACLE_CLIENT_LIB_DIR,
  });

  initialized = true;
}
