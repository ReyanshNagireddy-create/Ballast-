type Row = Record<string, unknown>;

export const db = {
  expense: {
    async findMany(_args: { take: number }): Promise<Row[]> {
      return [];
    },
    async create(args: { data: Row }): Promise<Row> {
      return args.data;
    },
  },
};
