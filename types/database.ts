
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "assignment_state": {
                  Row: {
                    "last_user_id": string | null,"scope": string,"updated_at": string
                  }
                  Insert: {
                    "last_user_id"?: string | null,"scope": string,"updated_at"?: string
                  }
                  Update: {
                    "last_user_id"?: string | null,"scope"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
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
                },"call_outcomes": {
                  Row: {
                    "code": string,"id": string,"is_active": boolean,"marks_contacted": boolean,"name": string,"requires_note": boolean,"sort_order": number
                  }
                  Insert: {
                    "code": string,"id"?: string,"is_active"?: boolean,"marks_contacted"?: boolean,"name": string,"requires_note"?: boolean,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"id"?: string,"is_active"?: boolean,"marks_contacted"?: boolean,"name"?: string,"requires_note"?: boolean,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"calls": {
                  Row: {
                    "agent_id": string,"created_at": string,"customer_id": string | null,"direction": string,"duration_sec": number | null,"ended_at": string | null,"id": string,"lead_id": string | null,"outcome_id": string | null,"outcome_note": string | null,"provider_call_id": string | null,"recording_consent": boolean,"recording_expires_at": string | null,"recording_path": string | null,"started_at": string
                  }
                  Insert: {
                    "agent_id": string,"created_at"?: string,"customer_id"?: string | null,"direction": string,"duration_sec"?: never,"ended_at"?: string | null,"id"?: string,"lead_id"?: string | null,"outcome_id"?: string | null,"outcome_note"?: string | null,"provider_call_id"?: string | null,"recording_consent"?: boolean,"recording_expires_at"?: string | null,"recording_path"?: string | null,"started_at": string
                  }
                  Update: {
                    "agent_id"?: string,"created_at"?: string,"customer_id"?: string | null,"direction"?: string,"duration_sec"?: never,"ended_at"?: string | null,"id"?: string,"lead_id"?: string | null,"outcome_id"?: string | null,"outcome_note"?: string | null,"provider_call_id"?: string | null,"recording_consent"?: boolean,"recording_expires_at"?: string | null,"recording_path"?: string | null,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calls_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calls_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calls_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calls_outcome_id_fkey"
      columns: ["outcome_id"]
isOneToOne: false
      referencedRelation: "call_outcomes"
      referencedColumns: ["id"]
    }
                  ]
                },"campaigns": {
                  Row: {
                    "ended_on": string | null,"external_id": string | null,"id": string,"name": string,"source_id": string,"spend_to_date": number | null,"started_on": string | null
                  }
                  Insert: {
                    "ended_on"?: string | null,"external_id"?: string | null,"id"?: string,"name": string,"source_id": string,"spend_to_date"?: number | null,"started_on"?: string | null
                  }
                  Update: {
                    "ended_on"?: string | null,"external_id"?: string | null,"id"?: string,"name"?: string,"source_id"?: string,"spend_to_date"?: number | null,"started_on"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaigns_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["id"]
    }
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
                },"customer_contacts": {
                  Row: {
                    "customer_id": string,"email": string | null,"id": string,"is_active": boolean,"is_primary": boolean,"name": string,"notify_prefs": NonNullable<Json>,"phone": string,"role_title": string | null,"user_id": string | null
                  }
                  Insert: {
                    "customer_id": string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"is_primary"?: boolean,"name": string,"notify_prefs"?: NonNullable<Json>,"phone": string,"role_title"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "customer_id"?: string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"is_primary"?: boolean,"name"?: string,"notify_prefs"?: NonNullable<Json>,"phone"?: string,"role_title"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_contacts_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "billing_address": string | null,"billing_city_id": string | null,"billing_state_code": string | null,"converted_at": string | null,"created_at": string,"gstin": string | null,"id": string,"is_prospect": boolean,"lead_id": string | null,"name": string,"type": string,"updated_at": string
                  }
                  Insert: {
                    "billing_address"?: string | null,"billing_city_id"?: string | null,"billing_state_code"?: string | null,"converted_at"?: string | null,"created_at"?: string,"gstin"?: string | null,"id"?: string,"is_prospect"?: boolean,"lead_id"?: string | null,"name": string,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "billing_address"?: string | null,"billing_city_id"?: string | null,"billing_state_code"?: string | null,"converted_at"?: string | null,"created_at"?: string,"gstin"?: string | null,"id"?: string,"is_prospect"?: boolean,"lead_id"?: string | null,"name"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_billing_city_id_fkey"
      columns: ["billing_city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customers_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
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
                },"fitting_conditions": {
                  Row: {
                    "condition_flag_id": string,"fitting_id": string
                  }
                  Insert: {
                    "condition_flag_id": string,"fitting_id": string
                  }
                  Update: {
                    "condition_flag_id"?: string,"fitting_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fitting_conditions_condition_flag_id_fkey"
      columns: ["condition_flag_id"]
isOneToOne: false
      referencedRelation: "condition_flags"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fitting_conditions_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: false
      referencedRelation: "fittings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fitting_conditions_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: false
      referencedRelation: "v_incomplete_fittings"
      referencedColumns: ["fitting_id"]
    }
                  ]
                },"fitting_photos": {
                  Row: {
                    "accuracy_m": number | null,"bytes": number | null,"captured_at": string,"device_id": string | null,"fitting_id": string,"height": number | null,"id": string,"lat": number | null,"lng": number | null,"marketing_use_consented": boolean,"sha256": string,"slot": string,"storage_path": string,"uploaded_at": string,"width": number | null
                  }
                  Insert: {
                    "accuracy_m"?: number | null,"bytes"?: number | null,"captured_at": string,"device_id"?: string | null,"fitting_id": string,"height"?: number | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"marketing_use_consented"?: boolean,"sha256": string,"slot": string,"storage_path": string,"uploaded_at"?: string,"width"?: number | null
                  }
                  Update: {
                    "accuracy_m"?: number | null,"bytes"?: number | null,"captured_at"?: string,"device_id"?: string | null,"fitting_id"?: string,"height"?: number | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"marketing_use_consented"?: boolean,"sha256"?: string,"slot"?: string,"storage_path"?: string,"uploaded_at"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fitting_photos_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: false
      referencedRelation: "fittings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fitting_photos_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: false
      referencedRelation: "v_incomplete_fittings"
      referencedColumns: ["fitting_id"]
    }
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
                },"fittings": {
                  Row: {
                    "brand_id": string | null,"captured_at": string,"created_at": string,"current_finish_id": string | null,"fitting_type_id": string,"id": string,"idem_key": string,"model": string | null,"notes": string | null,"property_unit_id": string | null,"survey_id": string,"unit_label": string | null
                  }
                  Insert: {
                    "brand_id"?: string | null,"captured_at": string,"created_at"?: string,"current_finish_id"?: string | null,"fitting_type_id": string,"id"?: string,"idem_key": string,"model"?: string | null,"notes"?: string | null,"property_unit_id"?: string | null,"survey_id": string,"unit_label"?: string | null
                  }
                  Update: {
                    "brand_id"?: string | null,"captured_at"?: string,"created_at"?: string,"current_finish_id"?: string | null,"fitting_type_id"?: string,"id"?: string,"idem_key"?: string,"model"?: string | null,"notes"?: string | null,"property_unit_id"?: string | null,"survey_id"?: string,"unit_label"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fittings_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fittings_current_finish_id_fkey"
      columns: ["current_finish_id"]
isOneToOne: false
      referencedRelation: "finishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fittings_fitting_type_id_fkey"
      columns: ["fitting_type_id"]
isOneToOne: false
      referencedRelation: "fitting_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fittings_property_unit_id_fkey"
      columns: ["property_unit_id"]
isOneToOne: false
      referencedRelation: "property_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fittings_survey_id_fkey"
      columns: ["survey_id"]
isOneToOne: false
      referencedRelation: "surveys"
      referencedColumns: ["id"]
    }
                  ]
                },"follow_ups": {
                  Row: {
                    "assigned_to": string,"completed_at": string | null,"created_at": string,"due_at": string,"id": string,"lead_id": string,"note": string | null
                  }
                  Insert: {
                    "assigned_to": string,"completed_at"?: string | null,"created_at"?: string,"due_at": string,"id"?: string,"lead_id": string,"note"?: string | null
                  }
                  Update: {
                    "assigned_to"?: string,"completed_at"?: string | null,"created_at"?: string,"due_at"?: string,"id"?: string,"lead_id"?: string,"note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "follow_ups_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_ups_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"lead_notes": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"id": string,"lead_id": string
                  }
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"lead_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"lead_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_notes_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"lead_sources": {
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
                },"lead_status_history": {
                  Row: {
                    "actor_id": string | null,"changed_at": string,"from_status": Database["public"]['Enums']["lead_status"] | null,"id": string,"lead_id": string,"note": string | null,"to_status": Database["public"]['Enums']["lead_status"]
                  }
                  Insert: {
                    "actor_id"?: string | null,"changed_at"?: string,"from_status"?: Database["public"]['Enums']["lead_status"] | null,"id"?: string,"lead_id": string,"note"?: string | null,"to_status": Database["public"]['Enums']["lead_status"]
                  }
                  Update: {
                    "actor_id"?: string | null,"changed_at"?: string,"from_status"?: Database["public"]['Enums']["lead_status"] | null,"id"?: string,"lead_id"?: string,"note"?: string | null,"to_status"?: Database["public"]['Enums']["lead_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_status_history_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_status_history_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"lead_touches": {
                  Row: {
                    "campaign_id": string | null,"id": string,"lead_id": string,"occurred_at": string,"payload": Json | null,"source_id": string
                  }
                  Insert: {
                    "campaign_id"?: string | null,"id"?: string,"lead_id": string,"occurred_at"?: string,"payload"?: Json | null,"source_id": string
                  }
                  Update: {
                    "campaign_id"?: string | null,"id"?: string,"lead_id"?: string,"occurred_at"?: string,"payload"?: Json | null,"source_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_touches_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_touches_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_touches_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "assigned_at": string | null,"assigned_to": string | null,"campaign_id": string | null,"city_id": string | null,"created_at": string,"ctwa_clid": string | null,"customer_type": string | null,"email": string | null,"enquirer_role": string | null,"firm_gstin": string | null,"google_lead_id": string | null,"id": string,"lost_note": string | null,"lost_reason_id": string | null,"meta_ad_id": string | null,"meta_form_id": string | null,"meta_leadgen_id": string | null,"name": string | null,"phone": string,"previous_lead_id": string | null,"property_name": string | null,"raw_payload": Json | null,"sla_due_at": string | null,"source_id": string,"status": Database["public"]['Enums']["lead_status"],"unit_count": number | null,"updated_at": string,"utm": Json | null
                  }
                  Insert: {
                    "assigned_at"?: string | null,"assigned_to"?: string | null,"campaign_id"?: string | null,"city_id"?: string | null,"created_at"?: string,"ctwa_clid"?: string | null,"customer_type"?: string | null,"email"?: string | null,"enquirer_role"?: string | null,"firm_gstin"?: string | null,"google_lead_id"?: string | null,"id"?: string,"lost_note"?: string | null,"lost_reason_id"?: string | null,"meta_ad_id"?: string | null,"meta_form_id"?: string | null,"meta_leadgen_id"?: string | null,"name"?: string | null,"phone": string,"previous_lead_id"?: string | null,"property_name"?: string | null,"raw_payload"?: Json | null,"sla_due_at"?: string | null,"source_id": string,"status"?: Database["public"]['Enums']["lead_status"],"unit_count"?: number | null,"updated_at"?: string,"utm"?: Json | null
                  }
                  Update: {
                    "assigned_at"?: string | null,"assigned_to"?: string | null,"campaign_id"?: string | null,"city_id"?: string | null,"created_at"?: string,"ctwa_clid"?: string | null,"customer_type"?: string | null,"email"?: string | null,"enquirer_role"?: string | null,"firm_gstin"?: string | null,"google_lead_id"?: string | null,"id"?: string,"lost_note"?: string | null,"lost_reason_id"?: string | null,"meta_ad_id"?: string | null,"meta_form_id"?: string | null,"meta_leadgen_id"?: string | null,"name"?: string | null,"phone"?: string,"previous_lead_id"?: string | null,"property_name"?: string | null,"raw_payload"?: Json | null,"sla_due_at"?: string | null,"source_id"?: string,"status"?: Database["public"]['Enums']["lead_status"],"unit_count"?: number | null,"updated_at"?: string,"utm"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_lost_reason_id_fkey"
      columns: ["lost_reason_id"]
isOneToOne: false
      referencedRelation: "lost_reasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_previous_lead_id_fkey"
      columns: ["previous_lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["id"]
    }
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
                },"properties": {
                  Row: {
                    "address": string,"city_id": string | null,"created_at": string,"customer_id": string,"id": string,"lat": number | null,"lng": number | null,"name": string,"unit_label": string,"updated_at": string
                  }
                  Insert: {
                    "address": string,"city_id"?: string | null,"created_at"?: string,"customer_id": string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name": string,"unit_label"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string,"city_id"?: string | null,"created_at"?: string,"customer_id"?: string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name"?: string,"unit_label"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "properties_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "properties_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"property_units": {
                  Row: {
                    "created_at": string,"floor": string | null,"id": string,"label": string,"notes": string | null,"property_id": string,"wing": string | null
                  }
                  Insert: {
                    "created_at"?: string,"floor"?: string | null,"id"?: string,"label": string,"notes"?: string | null,"property_id": string,"wing"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"floor"?: string | null,"id"?: string,"label"?: string,"notes"?: string | null,"property_id"?: string,"wing"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "property_units_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
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
                },"survey_checkins": {
                  Row: {
                    "accuracy_m": number | null,"checked_in_at": string,"device_id": string | null,"distance_m": number | null,"flag_reason": string | null,"flagged": boolean,"geofence_ok": boolean | null,"id": string,"idem_key": string,"is_mocked": boolean,"lat": number,"lng": number,"received_at": string,"survey_id": string,"surveyor_id": string
                  }
                  Insert: {
                    "accuracy_m"?: number | null,"checked_in_at": string,"device_id"?: string | null,"distance_m"?: number | null,"flag_reason"?: string | null,"flagged"?: boolean,"geofence_ok"?: boolean | null,"id"?: string,"idem_key": string,"is_mocked"?: boolean,"lat": number,"lng": number,"received_at"?: string,"survey_id": string,"surveyor_id": string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"checked_in_at"?: string,"device_id"?: string | null,"distance_m"?: number | null,"flag_reason"?: string | null,"flagged"?: boolean,"geofence_ok"?: boolean | null,"id"?: string,"idem_key"?: string,"is_mocked"?: boolean,"lat"?: number,"lng"?: number,"received_at"?: string,"survey_id"?: string,"surveyor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "survey_checkins_survey_id_fkey"
      columns: ["survey_id"]
isOneToOne: false
      referencedRelation: "surveys"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "survey_checkins_surveyor_id_fkey"
      columns: ["surveyor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"surveys": {
                  Row: {
                    "booked_by": string | null,"cancel_reason": string | null,"created_at": string,"id": string,"lead_id": string | null,"property_id": string,"scheduled_at": string,"slot_end_at": string,"status": Database["public"]['Enums']["survey_status"],"submitted_at": string | null,"surveyor_id": string,"updated_at": string
                  }
                  Insert: {
                    "booked_by"?: string | null,"cancel_reason"?: string | null,"created_at"?: string,"id"?: string,"lead_id"?: string | null,"property_id": string,"scheduled_at": string,"slot_end_at": string,"status"?: Database["public"]['Enums']["survey_status"],"submitted_at"?: string | null,"surveyor_id": string,"updated_at"?: string
                  }
                  Update: {
                    "booked_by"?: string | null,"cancel_reason"?: string | null,"created_at"?: string,"id"?: string,"lead_id"?: string | null,"property_id"?: string,"scheduled_at"?: string,"slot_end_at"?: string,"status"?: Database["public"]['Enums']["survey_status"],"submitted_at"?: string | null,"surveyor_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "surveys_booked_by_fkey"
      columns: ["booked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "surveys_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "surveys_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "surveys_surveyor_id_fkey"
      columns: ["surveyor_id"]
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
            "v_incomplete_fittings": {
                  Row: {
                    "fitting_id": string | null,"slots_filled": number | null,"survey_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fittings_survey_id_fkey"
      columns: ["survey_id"]
isOneToOne: false
      referencedRelation: "surveys"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "assign_lead":
{ Args: { "p_city_id": string }; Returns: string
                           },
"authorize":
{ Args: { "requested": string }; Returns: boolean
                           },
"available_surveyors":
{ Args: { "p_property_id": string,"p_start": string }; Returns: {
              "full_name": string,"same_city": boolean,"surveyor_id": string,"surveys_that_day": number
            }[]
                           },
"book_survey":
{ Args: { "p": Json }; Returns: Json
                           },
"current_role_is":
{ Args: { "target": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"custom_access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"distance_m":
{ Args: { "lat1": number,"lat2": number,"lng1": number,"lng2": number }; Returns: number
                           },
"ensure_prospect":
{ Args: { "p_lead_id": string,"p_property": Json }; Returns: Json
                           },
"ingest_lead":
{ Args: { "p_lead": Json }; Returns: Json
                           },
"is_my_survey_lead":
{ Args: { "p_lead_id": string }; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"log_call":
{ Args: { "p_call": Json }; Returns: string
                           },
"my_customer_ids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"staff_can_see_customer":
{ Args: { "p_customer_id": string }; Returns: boolean
                           },
"submit_survey":
{ Args: { "p_survey_id": string }; Returns: undefined
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

