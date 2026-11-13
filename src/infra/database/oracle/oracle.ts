import oracledb from "oracledb";

let initialized = false;

export function initializeOracle() {
  if (initialized) {
    return;
  }

  if (process.platform === "linux") {
    oracledb.initOracleClient({ libDir: "/opt/oracle/instantclient_19_29" });
  } else {
    oracledb.initOracleClient();
  }

  initialized = true;
}
