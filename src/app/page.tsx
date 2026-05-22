import { redirect } from "next/navigation"

// Root redirects to the default locale — next-intl middleware handles
// locale detection on subsequent navigation.
export default function RootPage() {
  redirect("/de")
}
