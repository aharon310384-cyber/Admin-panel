import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { lockRemainingMs, registerFailure, registerSuccess } from "@/lib/login-guard";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/** Вход временно заблокирован после серии неудачных попыток (code → клиенту в SignInResponse). */
class LockedSignin extends CredentialsSignin {
  code = "locked";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        if (lockRemainingMs("admin", email) > 0) throw new LockedSignin();

        const user = await prisma.user.findFirst({
          where: { email, deletedAt: null },
        });

        const passwordMatch = user ? await bcrypt.compare(password, user.password) : false;
        if (!user || !passwordMatch) {
          if (registerFailure("admin", email)) throw new LockedSignin();
          return null;
        }

        registerSuccess("admin", email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
