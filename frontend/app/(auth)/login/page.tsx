import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect(`${process.env.NEXT_PUBLIC_BASE_URL_ACCOUNTS}accounts/login/`);
}