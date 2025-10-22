import "server-only";

const DATABASE_ERROR_TAG = "DatabaseError";

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `${DATABASE_ERROR_TAG}:Configuration`;
  }
}

export class DatabaseQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `${DATABASE_ERROR_TAG}:Query`;
  }
}

type QueryResult<Row> = {
  rows: Row[];
  rowCount: number;
};

type NeonHttpPayload<Row> = {
  results?: Array<{
    command: string;
    fields: Array<{ name: string; dataTypeID: number }>;
    rows: Row[];
    rowCount?: number;
  }>;
  error?: {
    message: string;
    code?: string;
  };
};

class NeonHttpClient {
  private readonly endpoint: string;
  private readonly headers: HeadersInit;

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new DatabaseConfigurationError(
        "DATABASE_URL が設定されていません。環境変数を確認してください。",
      );
    }

    const url = new URL(connectionString);
    if (!/^postgres(ql)?:$/.test(url.protocol)) {
      throw new DatabaseConfigurationError(
        "DATABASE_URL が PostgreSQL の接続文字列ではありません。",
      );
    }

    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const database = url.pathname.replace(/^\//, "");

    if (!username || !password) {
      throw new DatabaseConfigurationError(
        "DATABASE_URL にユーザー名またはパスワードが含まれていません。",
      );
    }

    if (!database) {
      throw new DatabaseConfigurationError(
        "DATABASE_URL にデータベース名が含まれていません。",
      );
    }

    const host = url.hostname;
    if (!host) {
      throw new DatabaseConfigurationError(
        "DATABASE_URL にホスト名が含まれていません。",
      );
    }

    const portSegment = url.port ? `:${url.port}` : "";
    const baseUrl = `https://${host}${portSegment}`;
    this.endpoint = `${baseUrl}/sql${url.search || ""}`;

    const authorization = Buffer.from(`${username}:${password}`).toString(
      "base64",
    );
    this.headers = {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Neon-Database": database,
      "User-Agent": "bunlint-history-cleanup/1.0",
    } satisfies HeadersInit;
  }

  async query<Row = Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ query: { text, values } }),
      });

      const payload = (await response.json()) as NeonHttpPayload<Row>;

      if (!response.ok) {
        const message = payload.error?.message ?? response.statusText;
        throw new DatabaseQueryError(
          message || "SQL クエリの実行に失敗しました。",
        );
      }

      if (payload.error) {
        throw new DatabaseQueryError(payload.error.message);
      }

      const [firstResult] = payload.results ?? [];
      if (!firstResult) {
        return { rows: [], rowCount: 0 };
      }

      const rows = Array.isArray(firstResult.rows) ? firstResult.rows : [];
      const rowCount =
        typeof firstResult.rowCount === "number"
          ? firstResult.rowCount
          : rows.length;

      return { rows, rowCount };
    } catch (error) {
      if (error instanceof DatabaseQueryError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        throw new DatabaseQueryError(
          "データベースからのレスポンスを解析できませんでした。",
        );
      }

      const message =
        error instanceof Error ? error.message : "未知のエラーが発生しました。";
      throw new DatabaseQueryError(message);
    }
  }
}

type GlobalNeonClient = {
  client?: NeonHttpClient;
};

const globalForNeon = globalThis as unknown as GlobalNeonClient;

export type DatabaseClient = NeonHttpClient;

export function getDatabaseClient(): DatabaseClient {
  if (!globalForNeon.client) {
    const connectionString = process.env.DATABASE_URL ?? "";
    globalForNeon.client = new NeonHttpClient(connectionString);
  }

  return globalForNeon.client;
}

export type { QueryResult };
