import type { Prisma } from "@prisma/client";

export const ORDER_NOT_IN_ACTIVE_PARCEL: Prisma.OrderWhereInput = {
  parcelItems: {
    none: {
      parcel: {
        deletedAt: null,
        status: { not: "CANCELED" },
      },
    },
  },
};
