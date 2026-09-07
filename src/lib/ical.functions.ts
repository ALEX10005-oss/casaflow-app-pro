import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncPropertyCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { calendar_id: string }) => input)
  .handler(async () => {
    throw new Error(
      "iCal está deshabilitado desde el 7 de septiembre de 2026. Las nuevas reservas deben importarse mediante CSV.",
    );
  });
