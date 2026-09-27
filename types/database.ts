
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "assignment_state": {
                  Row: {
                    "city_id": string,"last_user_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "city_id": string,"last_user_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "city_id"?: string,"last_user_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignment_state_city_id_fkey"
      columns: ["city_id"]
isOneToOne: true
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignment_state_last_user_id_fkey"
      columns: ["last_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": Database["public"]['Enums']["app_role"] | null,"after": Json | null,"before": Json | null,"entity_id": string | null,"entity_type": string,"id": number,"ip_address": unknown,"occurred_at": string
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["app_role"] | null,"after"?: Json | null,"before"?: Json | null,"entity_id"?: string | null,"entity_type": string,"id"?: number,"ip_address"?: unknown,"occurred_at"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["app_role"] | null,"after"?: Json | null,"before"?: Json | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: number,"ip_address"?: unknown,"occurred_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"brands": {
                  Row: {
                    "id": string,"is_active": boolean,"name": string
                  }
                  Insert: {
                    "id"?: string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cities": {
                  Row: {
                    "id": string,"is_active": boolean,"name": string,"state_code": string
                  }
                  Insert: {
                    "id"?: string,"is_active"?: boolean,"name": string,"state_code": string
                  }
                  Update: {
                    "id"?: string,"is_active"?: boolean,"name"?: string,"state_code"?: string
                  }
                  Relationships: [
                    
                  ]
                },"condition_flags": {
                  Row: {
                    "code": string,"id": string,"is_active": boolean,"name": string,"sort_order": number
                  }
                  Insert: {
                    "code": string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"finishes": {
                  Row: {
                    "code": string,"hex": string | null,"id": string,"is_active": boolean,"name": string
                  }
                  Insert: {
                    "code": string,"hex"?: string | null,"id"?: string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "code"?: string,"hex"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fitting_types": {
                  Row: {
                    "code": string,"id": string,"is_active": boolean,"name": string,"sort_order": number
                  }
                  Insert: {
                    "code": string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"lost_reasons": {
                  Row: {
                    "code": string,"id": string,"is_active": boolean,"name": string,"requires_note": boolean,"sort_order": number
                  }
                  Insert: {
                    "code": string,"id"?: string,"is_active"?: boolean,"name": string,"requires_note"?: boolean,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"requires_note"?: boolean,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"city_id": string | null,"created_at": string,"email": string | null,"full_name": string,"id": string,"is_active": boolean,"phone": string | null,"recording_consent_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"city_id"?: string | null,"created_at"?: string,"email"?: string | null,"full_name": string,"id": string,"is_active"?: boolean,"phone"?: string | null,"recording_consent_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"city_id"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"is_active"?: boolean,"phone"?: string | null,"recording_consent_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "id": string,"permission": string,"role": Database["public"]['Enums']["app_role"]
                  }
                  Insert: {
                    "id"?: string,"permission": string,"role": Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "id"?: string,"permission"?: string,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    
                  ]
                },"settings": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "id": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Insert: {
                    "id"?: string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "id"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"work_types": {
                  Row: {
                    "code": string,"id": string,"is_active": boolean,"name": string
                  }
                  Insert: {
                    "code": string,"id"?: string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "code"?: string,"id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "authorize":
{ Args: { "requested": string }; Returns: boolean
                           },
"current_role_is":
{ Args: { "target": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"custom_access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            "app_role": "super_admin"|"cc_exec"|"surveyor"|"customer","consent_purpose": "service"|"marketing"|"call_recording"|"photo_marketing","dsr_status": "received"|"in_progress"|"completed"|"rejected","dsr_type": "access"|"correction"|"erasure"|"nomination"|"withdraw_consent","invoice_status": "draft"|"issued"|"part_paid"|"paid"|"cancelled","job_stage": "dates_confirmed"|"removal_pickup"|"at_eurobrass"|"quality_check"|"refit_test"|"handover"|"warranty_active","job_status": "planned"|"in_progress"|"completed"|"cancelled","lead_status": "new"|"contacted"|"survey_booked"|"surveyed"|"quoted"|"won"|"lost","msg_category": "utility"|"marketing"|"authentication"|"service","msg_channel": "whatsapp"|"sms"|"email"|"in_app"|"push","msg_status": "queued"|"sent"|"delivered"|"read"|"failed","payment_status": "created"|"captured"|"failed"|"refunded","quote_status": "draft"|"pending_approval"|"sent"|"approved"|"rejected"|"expired"|"superseded","stock_move_type": "in"|"out"|"consumed"|"adjusted","survey_status": "scheduled"|"checked_in"|"in_progress"|"submitted"|"cancelled","treatment": "restore_finish"|"repair_function"|"replace_eurobrass"|"no_action","unit_status": "scheduled"|"in_progress"|"blocked"|"back_in_service","webhook_source": "meta_leadgen"|"whatsapp"|"google_ads"|"razorpay","webhook_status": "pending"|"processing"|"done"|"failed"|"dead"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["super_admin", "cc_exec", "surveyor", "customer"],"consent_purpose": ["service", "marketing", "call_recording", "photo_marketing"],"dsr_status": ["received", "in_progress", "completed", "rejected"],"dsr_type": ["access", "correction", "erasure", "nomination", "withdraw_consent"],"invoice_status": ["draft", "issued", "part_paid", "paid", "cancelled"],"job_stage": ["dates_confirmed", "removal_pickup", "at_eurobrass", "quality_check", "refit_test", "handover", "warranty_active"],"job_status": ["planned", "in_progress", "completed", "cancelled"],"lead_status": ["new", "contacted", "survey_booked", "surveyed", "quoted", "won", "lost"],"msg_category": ["utility", "marketing", "authentication", "service"],"msg_channel": ["whatsapp", "sms", "email", "in_app", "push"],"msg_status": ["queued", "sent", "delivered", "read", "failed"],"payment_status": ["created", "captured", "failed", "refunded"],"quote_status": ["draft", "pending_approval", "sent", "approved", "rejected", "expired", "superseded"],"stock_move_type": ["in", "out", "consumed", "adjusted"],"survey_status": ["scheduled", "checked_in", "in_progress", "submitted", "cancelled"],"treatment": ["restore_finish", "repair_function", "replace_eurobrass", "no_action"],"unit_status": ["scheduled", "in_progress", "blocked", "back_in_service"],"webhook_source": ["meta_leadgen", "whatsapp", "google_ads", "razorpay"],"webhook_status": ["pending", "processing", "done", "failed", "dead"]
          }
        }
} as const

