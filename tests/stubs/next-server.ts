type CookieOptions = {
  value?: string | number | boolean;
  path?: string;
  expires?: Date | string | number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none" | undefined | string;
} & Record<string, unknown>;

export class NextResponse extends Response {
  cookies: {
    set: (name: string, value: string | CookieOptions) => void;
  };

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init);
    this.cookies = {
      set: (
        nameOrOptions: string | CookieOptions,
        valueOrOptions?: string | CookieOptions,
      ) => {
        let name: string | undefined;
        let options: CookieOptions = {};

        if (typeof nameOrOptions === "string") {
          name = nameOrOptions;
          if (typeof valueOrOptions === "string") {
            options.value = valueOrOptions;
          } else if (valueOrOptions && typeof valueOrOptions === "object") {
            options = { ...valueOrOptions };
          }
        } else if (nameOrOptions && typeof nameOrOptions === "object") {
          const candidate = { ...nameOrOptions } as CookieOptions & {
            name?: unknown;
          };
          if (typeof candidate.name === "string") {
            name = candidate.name;
          }
          delete (candidate as { name?: unknown }).name;
          options = candidate;
        }

        if (!name) {
          return;
        }

        const rawValue = options.value;
        const cookieValue =
          typeof rawValue === "string"
            ? rawValue
            : rawValue != null
              ? String(rawValue)
              : "";

        const parts = [`${name}=${cookieValue}`];

        if (typeof options.path === "string") {
          parts.push(`Path=${options.path}`);
        }

        if (options.expires) {
          const expires =
            options.expires instanceof Date
              ? options.expires
              : new Date(options.expires);
          parts.push(`Expires=${expires.toUTCString()}`);
        }

        if (options.httpOnly) {
          parts.push("HttpOnly");
        }

        if (options.secure) {
          parts.push("Secure");
        }

        if (options.sameSite) {
          const valueLower = String(options.sameSite).toLowerCase();
          parts.push(
            `SameSite=${valueLower.charAt(0).toUpperCase()}${valueLower.slice(1)}`,
          );
        }

        this.headers.append("set-cookie", parts.join("; "));
      },
    };
  }

  static json<T>(body: T, init?: ResponseInit): NextResponse {
    const headers = new Headers(init?.headers);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return new NextResponse(JSON.stringify(body), { ...init, headers });
  }
}
