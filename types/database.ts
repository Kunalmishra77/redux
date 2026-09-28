
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "assessments": {
                  Row: {
                    "created_at": string,"created_by": string | null,"finish_id": string | null,"fitting_id": string,"id": string,"is_manual_override": boolean,"override_reason": string | null,"part_unavailable_note": string | null,"price_market_replacement": number,"price_recommended": number,"price_replace_eurobrass": number,"rate_card_id": string,"recommended": Database["public"]['Enums']["treatment"],"surveyor_note": string | null,"updated_at": string,"you_save": number | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"finish_id"?: string | null,"fitting_id": string,"id"?: string,"is_manual_override"?: boolean,"override_reason"?: string | null,"part_unavailable_note"?: string | null,"price_market_replacement": number,"price_recommended": number,"price_replace_eurobrass": number,"rate_card_id": string,"recommended": Database["public"]['Enums']["treatment"],"surveyor_note"?: string | null,"updated_at"?: string,"you_save"?: never
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"finish_id"?: string | null,"fitting_id"?: string,"id"?: string,"is_manual_override"?: boolean,"override_reason"?: string | null,"part_unavailable_note"?: string | null,"price_market_replacement"?: number,"price_recommended"?: number,"price_replace_eurobrass"?: number,"rate_card_id"?: string,"recommended"?: Database["public"]['Enums']["treatment"],"surveyor_note"?: string | null,"updated_at"?: string,"you_save"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessments_finish_id_fkey"
      columns: ["finish_id"]
isOneToOne: false
      referencedRelation: "finishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessments_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: true
      referencedRelation: "fittings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessments_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: true
      referencedRelation: "v_incomplete_fittings"
      referencedColumns: ["fitting_id"]
    },{
      foreignKeyName: "assessments_rate_card_id_fkey"
      columns: ["rate_card_id"]
isOneToOne: false
      referencedRelation: "rate_cards"
      referencedColumns: ["id"]
    }
                  ]
                },"assignment_state": {
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
                },"capi_events": {
                  Row: {
                    "created_at": string,"ctwa_clid": string | null,"currency": string,"event_name": string,"id": string,"lead_id": string,"response": Json | null,"sent_at": string | null,"status": string,"value": number | null
                  }
                  Insert: {
                    "created_at"?: string,"ctwa_clid"?: string | null,"currency"?: string,"event_name": string,"id"?: string,"lead_id": string,"response"?: Json | null,"sent_at"?: string | null,"status"?: string,"value"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"ctwa_clid"?: string | null,"currency"?: string,"event_name"?: string,"id"?: string,"lead_id"?: string,"response"?: Json | null,"sent_at"?: string | null,"status"?: string,"value"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "capi_events_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
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
                },"credit_notes": {
                  Row: {
                    "amount": number,"cgst": number,"created_at": string,"created_by": string | null,"credit_no": string,"id": string,"igst": number,"invoice_id": string,"issue_date": string,"pdf_path": string | null,"reason": string,"series_id": string,"sgst": number,"taxable_value": number
                  }
                  Insert: {
                    "amount": number,"cgst"?: number,"created_at"?: string,"created_by"?: string | null,"credit_no": string,"id"?: string,"igst"?: number,"invoice_id": string,"issue_date": string,"pdf_path"?: string | null,"reason": string,"series_id": string,"sgst"?: number,"taxable_value": number
                  }
                  Update: {
                    "amount"?: number,"cgst"?: number,"created_at"?: string,"created_by"?: string | null,"credit_no"?: string,"id"?: string,"igst"?: number,"invoice_id"?: string,"issue_date"?: string,"pdf_path"?: string | null,"reason"?: string,"series_id"?: string,"sgst"?: number,"taxable_value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_notes_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "credit_notes_series_id_fkey"
      columns: ["series_id"]
isOneToOne: false
      referencedRelation: "invoice_series"
      referencedColumns: ["id"]
    }
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
                },"discount_approvals": {
                  Row: {
                    "decided_at": string | null,"decided_by": string | null,"decision": string | null,"decision_note": string | null,"id": string,"quotation_id": string,"reason": string,"requested_at": string,"requested_by": string,"requested_pct": number
                  }
                  Insert: {
                    "decided_at"?: string | null,"decided_by"?: string | null,"decision"?: string | null,"decision_note"?: string | null,"id"?: string,"quotation_id": string,"reason": string,"requested_at"?: string,"requested_by": string,"requested_pct": number
                  }
                  Update: {
                    "decided_at"?: string | null,"decided_by"?: string | null,"decision"?: string | null,"decision_note"?: string | null,"id"?: string,"quotation_id"?: string,"reason"?: string,"requested_at"?: string,"requested_by"?: string,"requested_pct"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "discount_approvals_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "discount_approvals_quotation_id_fkey"
      columns: ["quotation_id"]
isOneToOne: false
      referencedRelation: "quotations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "discount_approvals_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"handover_photos": {
                  Row: {
                    "captured_at": string,"fitting_id": string | null,"handover_id": string,"id": string,"sha256": string,"storage_path": string
                  }
                  Insert: {
                    "captured_at"?: string,"fitting_id"?: string | null,"handover_id": string,"id"?: string,"sha256": string,"storage_path": string
                  }
                  Update: {
                    "captured_at"?: string,"fitting_id"?: string | null,"handover_id"?: string,"id"?: string,"sha256"?: string,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "handover_photos_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: false
      referencedRelation: "fittings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "handover_photos_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: false
      referencedRelation: "v_incomplete_fittings"
      referencedColumns: ["fitting_id"]
    },{
      foreignKeyName: "handover_photos_handover_id_fkey"
      columns: ["handover_id"]
isOneToOne: false
      referencedRelation: "handovers"
      referencedColumns: ["id"]
    }
                  ]
                },"handovers": {
                  Row: {
                    "completed_at": string,"customer_name": string,"finish_check": boolean,"id": string,"job_unit_id": string,"leak_check": boolean,"notes": string | null,"operation_check": boolean,"signature_path": string | null,"surveyor_id": string | null
                  }
                  Insert: {
                    "completed_at"?: string,"customer_name": string,"finish_check": boolean,"id"?: string,"job_unit_id": string,"leak_check": boolean,"notes"?: string | null,"operation_check": boolean,"signature_path"?: string | null,"surveyor_id"?: string | null
                  }
                  Update: {
                    "completed_at"?: string,"customer_name"?: string,"finish_check"?: boolean,"id"?: string,"job_unit_id"?: string,"leak_check"?: boolean,"notes"?: string | null,"operation_check"?: boolean,"signature_path"?: string | null,"surveyor_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "handovers_job_unit_id_fkey"
      columns: ["job_unit_id"]
isOneToOne: true
      referencedRelation: "job_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "handovers_job_unit_id_fkey"
      columns: ["job_unit_id"]
isOneToOne: true
      referencedRelation: "v_delayed_units"
      referencedColumns: ["job_unit_id"]
    },{
      foreignKeyName: "handovers_surveyor_id_fkey"
      columns: ["surveyor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"integration_accounts": {
                  Row: {
                    "config": NonNullable<Json>,"display_name": string | null,"external_id": string | null,"id": string,"is_active": boolean,"last_event_at": string | null,"provider": string
                  }
                  Insert: {
                    "config"?: NonNullable<Json>,"display_name"?: string | null,"external_id"?: string | null,"id"?: string,"is_active"?: boolean,"last_event_at"?: string | null,"provider": string
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"display_name"?: string | null,"external_id"?: string | null,"id"?: string,"is_active"?: boolean,"last_event_at"?: string | null,"provider"?: string
                  }
                  Relationships: [
                    
                  ]
                },"invoice_lines": {
                  Row: {
                    "cgst": number,"description": string,"gst_rate": number,"hsn_sac": string | null,"id": string,"igst": number,"invoice_id": string,"line_total": number,"qty": number,"sgst": number,"sort_order": number,"taxable_value": number,"unit_price": number,"uom": string
                  }
                  Insert: {
                    "cgst"?: number,"description": string,"gst_rate": number,"hsn_sac"?: string | null,"id"?: string,"igst"?: number,"invoice_id": string,"line_total": number,"qty"?: number,"sgst"?: number,"sort_order"?: number,"taxable_value": number,"unit_price": number,"uom"?: string
                  }
                  Update: {
                    "cgst"?: number,"description"?: string,"gst_rate"?: number,"hsn_sac"?: string | null,"id"?: string,"igst"?: number,"invoice_id"?: string,"line_total"?: number,"qty"?: number,"sgst"?: number,"sort_order"?: number,"taxable_value"?: number,"unit_price"?: number,"uom"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_lines_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_series": {
                  Row: {
                    "code": string,"fy_end": string,"fy_start": string,"id": string,"next_number": number
                  }
                  Insert: {
                    "code": string,"fy_end": string,"fy_start": string,"id"?: string,"next_number"?: number
                  }
                  Update: {
                    "code"?: string,"fy_end"?: string,"fy_start"?: string,"id"?: string,"next_number"?: number
                  }
                  Relationships: [
                    
                  ]
                },"invoices": {
                  Row: {
                    "amount_paid": number,"cancelled_at": string | null,"cgst": number,"created_at": string,"created_by": string | null,"customer_id": string,"discount_amount": number,"due_date": string | null,"id": string,"igst": number,"invoice_no": string | null,"issue_date": string | null,"job_id": string | null,"payment_link_url": string | null,"payment_route": string | null,"pdf_path": string | null,"pdf_sha256": string | null,"place_of_supply_state_code": string,"quotation_id": string | null,"recipient_address": string,"recipient_gstin": string | null,"recipient_name": string,"reverse_charge": boolean,"series_id": string | null,"sgst": number,"status": Database["public"]['Enums']["invoice_status"],"subtotal": number,"supplier_address": string | null,"supplier_gstin": string | null,"supplier_name": string | null,"supplier_state_code": string | null,"supply_date": string | null,"taxable_value": number,"total": number,"updated_at": string,"virtual_account_details": Json | null,"virtual_account_id": string | null
                  }
                  Insert: {
                    "amount_paid"?: number,"cancelled_at"?: string | null,"cgst"?: number,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"discount_amount"?: number,"due_date"?: string | null,"id"?: string,"igst"?: number,"invoice_no"?: string | null,"issue_date"?: string | null,"job_id"?: string | null,"payment_link_url"?: string | null,"payment_route"?: string | null,"pdf_path"?: string | null,"pdf_sha256"?: string | null,"place_of_supply_state_code": string,"quotation_id"?: string | null,"recipient_address": string,"recipient_gstin"?: string | null,"recipient_name": string,"reverse_charge"?: boolean,"series_id"?: string | null,"sgst"?: number,"status"?: Database["public"]['Enums']["invoice_status"],"subtotal"?: number,"supplier_address"?: string | null,"supplier_gstin"?: string | null,"supplier_name"?: string | null,"supplier_state_code"?: string | null,"supply_date"?: string | null,"taxable_value"?: number,"total"?: number,"updated_at"?: string,"virtual_account_details"?: Json | null,"virtual_account_id"?: string | null
                  }
                  Update: {
                    "amount_paid"?: number,"cancelled_at"?: string | null,"cgst"?: number,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"discount_amount"?: number,"due_date"?: string | null,"id"?: string,"igst"?: number,"invoice_no"?: string | null,"issue_date"?: string | null,"job_id"?: string | null,"payment_link_url"?: string | null,"payment_route"?: string | null,"pdf_path"?: string | null,"pdf_sha256"?: string | null,"place_of_supply_state_code"?: string,"quotation_id"?: string | null,"recipient_address"?: string,"recipient_gstin"?: string | null,"recipient_name"?: string,"reverse_charge"?: boolean,"series_id"?: string | null,"sgst"?: number,"status"?: Database["public"]['Enums']["invoice_status"],"subtotal"?: number,"supplier_address"?: string | null,"supplier_gstin"?: string | null,"supplier_name"?: string | null,"supplier_state_code"?: string | null,"supply_date"?: string | null,"taxable_value"?: number,"total"?: number,"updated_at"?: string,"virtual_account_details"?: Json | null,"virtual_account_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "v_invoices_due"
      referencedColumns: ["job_id"]
    },{
      foreignKeyName: "invoices_quotation_id_fkey"
      columns: ["quotation_id"]
isOneToOne: false
      referencedRelation: "quotations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_series_id_fkey"
      columns: ["series_id"]
isOneToOne: false
      referencedRelation: "invoice_series"
      referencedColumns: ["id"]
    }
                  ]
                },"job_batches": {
                  Row: {
                    "id": string,"job_id": string,"name": string,"planned_from": string | null,"planned_to": string | null,"sort_order": number
                  }
                  Insert: {
                    "id"?: string,"job_id": string,"name": string,"planned_from"?: string | null,"planned_to"?: string | null,"sort_order"?: number
                  }
                  Update: {
                    "id"?: string,"job_id"?: string,"name"?: string,"planned_from"?: string | null,"planned_to"?: string | null,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_batches_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_batches_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "v_invoices_due"
      referencedColumns: ["job_id"]
    }
                  ]
                },"job_stage_events": {
                  Row: {
                    "actor_id": string | null,"backward_reason": string | null,"from_stage": Database["public"]['Enums']["job_stage"] | null,"id": string,"is_backward": boolean,"job_id": string,"job_unit_id": string | null,"note": string | null,"occurred_at": string,"to_stage": Database["public"]['Enums']["job_stage"]
                  }
                  Insert: {
                    "actor_id"?: string | null,"backward_reason"?: string | null,"from_stage"?: Database["public"]['Enums']["job_stage"] | null,"id"?: string,"is_backward"?: boolean,"job_id": string,"job_unit_id"?: string | null,"note"?: string | null,"occurred_at"?: string,"to_stage": Database["public"]['Enums']["job_stage"]
                  }
                  Update: {
                    "actor_id"?: string | null,"backward_reason"?: string | null,"from_stage"?: Database["public"]['Enums']["job_stage"] | null,"id"?: string,"is_backward"?: boolean,"job_id"?: string,"job_unit_id"?: string | null,"note"?: string | null,"occurred_at"?: string,"to_stage"?: Database["public"]['Enums']["job_stage"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_stage_events_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_stage_events_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "v_invoices_due"
      referencedColumns: ["job_id"]
    },{
      foreignKeyName: "job_stage_events_job_unit_id_fkey"
      columns: ["job_unit_id"]
isOneToOne: false
      referencedRelation: "job_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_stage_events_job_unit_id_fkey"
      columns: ["job_unit_id"]
isOneToOne: false
      referencedRelation: "v_delayed_units"
      referencedColumns: ["job_unit_id"]
    }
                  ]
                },"job_units": {
                  Row: {
                    "back_in_service_at": string | null,"batch_id": string | null,"current_stage": Database["public"]['Enums']["job_stage"],"downtime_from": string | null,"downtime_to": string | null,"id": string,"job_id": string,"planned_downtime_hours": number | null,"property_unit_id": string,"status": Database["public"]['Enums']["unit_status"]
                  }
                  Insert: {
                    "back_in_service_at"?: string | null,"batch_id"?: string | null,"current_stage"?: Database["public"]['Enums']["job_stage"],"downtime_from"?: string | null,"downtime_to"?: string | null,"id"?: string,"job_id": string,"planned_downtime_hours"?: number | null,"property_unit_id": string,"status"?: Database["public"]['Enums']["unit_status"]
                  }
                  Update: {
                    "back_in_service_at"?: string | null,"batch_id"?: string | null,"current_stage"?: Database["public"]['Enums']["job_stage"],"downtime_from"?: string | null,"downtime_to"?: string | null,"id"?: string,"job_id"?: string,"planned_downtime_hours"?: number | null,"property_unit_id"?: string,"status"?: Database["public"]['Enums']["unit_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_units_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "job_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_units_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_units_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "v_invoices_due"
      referencedColumns: ["job_id"]
    },{
      foreignKeyName: "job_units_property_unit_id_fkey"
      columns: ["property_unit_id"]
isOneToOne: false
      referencedRelation: "property_units"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "actual_end": string | null,"actual_start": string | null,"created_at": string,"current_stage": Database["public"]['Enums']["job_stage"],"customer_id": string,"id": string,"is_pilot": boolean,"job_no": string,"parent_job_id": string | null,"planned_end": string | null,"planned_start": string | null,"property_id": string,"quotation_id": string,"status": Database["public"]['Enums']["job_status"],"updated_at": string
                  }
                  Insert: {
                    "actual_end"?: string | null,"actual_start"?: string | null,"created_at"?: string,"current_stage"?: Database["public"]['Enums']["job_stage"],"customer_id": string,"id"?: string,"is_pilot"?: boolean,"job_no": string,"parent_job_id"?: string | null,"planned_end"?: string | null,"planned_start"?: string | null,"property_id": string,"quotation_id": string,"status"?: Database["public"]['Enums']["job_status"],"updated_at"?: string
                  }
                  Update: {
                    "actual_end"?: string | null,"actual_start"?: string | null,"created_at"?: string,"current_stage"?: Database["public"]['Enums']["job_stage"],"customer_id"?: string,"id"?: string,"is_pilot"?: boolean,"job_no"?: string,"parent_job_id"?: string | null,"planned_end"?: string | null,"planned_start"?: string | null,"property_id"?: string,"quotation_id"?: string,"status"?: Database["public"]['Enums']["job_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_parent_job_id_fkey"
      columns: ["parent_job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_parent_job_id_fkey"
      columns: ["parent_job_id"]
isOneToOne: false
      referencedRelation: "v_invoices_due"
      referencedColumns: ["job_id"]
    },{
      foreignKeyName: "jobs_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_quotation_id_fkey"
      columns: ["quotation_id"]
isOneToOne: true
      referencedRelation: "quotations"
      referencedColumns: ["id"]
    }
                  ]
                },"lead_form_field_map": {
                  Row: {
                    "field_name": string,"form_id": string,"id": string,"maps_to": string,"provider": string
                  }
                  Insert: {
                    "field_name": string,"form_id": string,"id"?: string,"maps_to": string,"provider": string
                  }
                  Update: {
                    "field_name"?: string,"form_id"?: string,"id"?: string,"maps_to"?: string,"provider"?: string
                  }
                  Relationships: [
                    
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
                },"market_prices": {
                  Row: {
                    "finish_id": string | null,"fitting_type_id": string,"id": string,"price": number,"rate_card_id": string
                  }
                  Insert: {
                    "finish_id"?: string | null,"fitting_type_id": string,"id"?: string,"price": number,"rate_card_id": string
                  }
                  Update: {
                    "finish_id"?: string | null,"fitting_type_id"?: string,"id"?: string,"price"?: number,"rate_card_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "market_prices_finish_id_fkey"
      columns: ["finish_id"]
isOneToOne: false
      referencedRelation: "finishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "market_prices_fitting_type_id_fkey"
      columns: ["fitting_type_id"]
isOneToOne: false
      referencedRelation: "fitting_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "market_prices_rate_card_id_fkey"
      columns: ["rate_card_id"]
isOneToOne: false
      referencedRelation: "rate_cards"
      referencedColumns: ["id"]
    }
                  ]
                },"message_templates": {
                  Row: {
                    "approved_at": string | null,"body": string,"category": Database["public"]['Enums']["msg_category"],"channel": Database["public"]['Enums']["msg_channel"],"code": string,"dlt_template_id": string | null,"id": string,"is_active": boolean,"language": string,"provider_template_name": string | null,"variables": NonNullable<Json>
                  }
                  Insert: {
                    "approved_at"?: string | null,"body": string,"category": Database["public"]['Enums']["msg_category"],"channel": Database["public"]['Enums']["msg_channel"],"code": string,"dlt_template_id"?: string | null,"id"?: string,"is_active"?: boolean,"language"?: string,"provider_template_name"?: string | null,"variables"?: NonNullable<Json>
                  }
                  Update: {
                    "approved_at"?: string | null,"body"?: string,"category"?: Database["public"]['Enums']["msg_category"],"channel"?: Database["public"]['Enums']["msg_channel"],"code"?: string,"dlt_template_id"?: string | null,"id"?: string,"is_active"?: boolean,"language"?: string,"provider_template_name"?: string | null,"variables"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"messages": {
                  Row: {
                    "attempts": number,"body": string | null,"category": Database["public"]['Enums']["msg_category"] | null,"channel": Database["public"]['Enums']["msg_channel"],"cost_inr": number | null,"customer_id": string | null,"dedup_key": string | null,"delivered_at": string | null,"entity_id": string | null,"entity_type": string | null,"error": string | null,"id": string,"lead_id": string | null,"provider_message_id": string | null,"queued_at": string,"rule_code": string | null,"send_after": string,"sent_at": string | null,"status": Database["public"]['Enums']["msg_status"],"template_code": string | null,"to_address": string,"variables": NonNullable<Json>
                  }
                  Insert: {
                    "attempts"?: number,"body"?: string | null,"category"?: Database["public"]['Enums']["msg_category"] | null,"channel": Database["public"]['Enums']["msg_channel"],"cost_inr"?: number | null,"customer_id"?: string | null,"dedup_key"?: string | null,"delivered_at"?: string | null,"entity_id"?: string | null,"entity_type"?: string | null,"error"?: string | null,"id"?: string,"lead_id"?: string | null,"provider_message_id"?: string | null,"queued_at"?: string,"rule_code"?: string | null,"send_after"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["msg_status"],"template_code"?: string | null,"to_address": string,"variables"?: NonNullable<Json>
                  }
                  Update: {
                    "attempts"?: number,"body"?: string | null,"category"?: Database["public"]['Enums']["msg_category"] | null,"channel"?: Database["public"]['Enums']["msg_channel"],"cost_inr"?: number | null,"customer_id"?: string | null,"dedup_key"?: string | null,"delivered_at"?: string | null,"entity_id"?: string | null,"entity_type"?: string | null,"error"?: string | null,"id"?: string,"lead_id"?: string | null,"provider_message_id"?: string | null,"queued_at"?: string,"rule_code"?: string | null,"send_after"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["msg_status"],"template_code"?: string | null,"to_address"?: string,"variables"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_rules": {
                  Row: {
                    "audience": string,"category": Database["public"]['Enums']["msg_category"] | null,"channel": Database["public"]['Enums']["msg_channel"],"code": string,"id": string,"is_active": boolean,"quiet_hours": boolean,"template_code": string | null,"trigger_event": string
                  }
                  Insert: {
                    "audience": string,"category"?: Database["public"]['Enums']["msg_category"] | null,"channel": Database["public"]['Enums']["msg_channel"],"code": string,"id"?: string,"is_active"?: boolean,"quiet_hours"?: boolean,"template_code"?: string | null,"trigger_event": string
                  }
                  Update: {
                    "audience"?: string,"category"?: Database["public"]['Enums']["msg_category"] | null,"channel"?: Database["public"]['Enums']["msg_channel"],"code"?: string,"id"?: string,"is_active"?: boolean,"quiet_hours"?: boolean,"template_code"?: string | null,"trigger_event"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"captured_at": string | null,"created_at": string,"id": string,"invoice_id": string,"method": string | null,"provider": string,"provider_payment_id": string,"raw_payload": Json | null,"status": Database["public"]['Enums']["payment_status"]
                  }
                  Insert: {
                    "amount": number,"captured_at"?: string | null,"created_at"?: string,"id"?: string,"invoice_id": string,"method"?: string | null,"provider"?: string,"provider_payment_id": string,"raw_payload"?: Json | null,"status": Database["public"]['Enums']["payment_status"]
                  }
                  Update: {
                    "amount"?: number,"captured_at"?: string | null,"created_at"?: string,"id"?: string,"invoice_id"?: string,"method"?: string | null,"provider"?: string,"provider_payment_id"?: string,"raw_payload"?: Json | null,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
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
                },"quotation_lines": {
                  Row: {
                    "assessment_id": string | null,"cgst": number,"description": string,"finish_id": string | null,"fitting_id": string | null,"gst_rate": number,"hsn_sac": string | null,"id": string,"igst": number,"line_total": number,"market_price": number,"price_replace_eurobrass": number | null,"qty": number,"quotation_id": string,"sgst": number,"sort_order": number,"taxable_value": number,"unit_label": string | null,"unit_price": number,"work_type_id": string | null
                  }
                  Insert: {
                    "assessment_id"?: string | null,"cgst"?: number,"description": string,"finish_id"?: string | null,"fitting_id"?: string | null,"gst_rate": number,"hsn_sac"?: string | null,"id"?: string,"igst"?: number,"line_total": number,"market_price"?: number,"price_replace_eurobrass"?: number | null,"qty"?: number,"quotation_id": string,"sgst"?: number,"sort_order"?: number,"taxable_value"?: number,"unit_label"?: string | null,"unit_price": number,"work_type_id"?: string | null
                  }
                  Update: {
                    "assessment_id"?: string | null,"cgst"?: number,"description"?: string,"finish_id"?: string | null,"fitting_id"?: string | null,"gst_rate"?: number,"hsn_sac"?: string | null,"id"?: string,"igst"?: number,"line_total"?: number,"market_price"?: number,"price_replace_eurobrass"?: number | null,"qty"?: number,"quotation_id"?: string,"sgst"?: number,"sort_order"?: number,"taxable_value"?: number,"unit_label"?: string | null,"unit_price"?: number,"work_type_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotation_lines_assessment_id_fkey"
      columns: ["assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotation_lines_finish_id_fkey"
      columns: ["finish_id"]
isOneToOne: false
      referencedRelation: "finishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotation_lines_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: false
      referencedRelation: "fittings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotation_lines_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: false
      referencedRelation: "v_incomplete_fittings"
      referencedColumns: ["fitting_id"]
    },{
      foreignKeyName: "quotation_lines_quotation_id_fkey"
      columns: ["quotation_id"]
isOneToOne: false
      referencedRelation: "quotations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotation_lines_work_type_id_fkey"
      columns: ["work_type_id"]
isOneToOne: false
      referencedRelation: "work_types"
      referencedColumns: ["id"]
    }
                  ]
                },"quotations": {
                  Row: {
                    "cgst": number,"created_at": string,"created_by": string | null,"customer_id": string,"discount_amount": number,"discount_pct": number,"id": string,"igst": number,"issued_at": string | null,"lead_id": string | null,"market_total": number,"pdf_path": string | null,"pdf_sha256": string | null,"place_of_supply_state_code": string | null,"property_id": string,"quote_no": string,"rate_card_id": string,"sgst": number,"status": Database["public"]['Enums']["quote_status"],"subtotal": number,"supersedes_id": string | null,"supplier_state_code": string | null,"survey_id": string,"taxable_value": number,"terms_text": string | null,"terms_version": string | null,"total": number,"updated_at": string,"valid_until": string | null,"version": number,"warranty_finish_days": number | null,"warranty_mechanical_days": number | null,"you_save": number
                  }
                  Insert: {
                    "cgst"?: number,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"discount_amount"?: number,"discount_pct"?: number,"id"?: string,"igst"?: number,"issued_at"?: string | null,"lead_id"?: string | null,"market_total"?: number,"pdf_path"?: string | null,"pdf_sha256"?: string | null,"place_of_supply_state_code"?: string | null,"property_id": string,"quote_no": string,"rate_card_id": string,"sgst"?: number,"status"?: Database["public"]['Enums']["quote_status"],"subtotal"?: number,"supersedes_id"?: string | null,"supplier_state_code"?: string | null,"survey_id": string,"taxable_value"?: number,"terms_text"?: string | null,"terms_version"?: string | null,"total"?: number,"updated_at"?: string,"valid_until"?: string | null,"version"?: number,"warranty_finish_days"?: number | null,"warranty_mechanical_days"?: number | null,"you_save"?: number
                  }
                  Update: {
                    "cgst"?: number,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"discount_amount"?: number,"discount_pct"?: number,"id"?: string,"igst"?: number,"issued_at"?: string | null,"lead_id"?: string | null,"market_total"?: number,"pdf_path"?: string | null,"pdf_sha256"?: string | null,"place_of_supply_state_code"?: string | null,"property_id"?: string,"quote_no"?: string,"rate_card_id"?: string,"sgst"?: number,"status"?: Database["public"]['Enums']["quote_status"],"subtotal"?: number,"supersedes_id"?: string | null,"supplier_state_code"?: string | null,"survey_id"?: string,"taxable_value"?: number,"terms_text"?: string | null,"terms_version"?: string | null,"total"?: number,"updated_at"?: string,"valid_until"?: string | null,"version"?: number,"warranty_finish_days"?: number | null,"warranty_mechanical_days"?: number | null,"you_save"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotations_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotations_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotations_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotations_rate_card_id_fkey"
      columns: ["rate_card_id"]
isOneToOne: false
      referencedRelation: "rate_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotations_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: false
      referencedRelation: "quotations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotations_survey_id_fkey"
      columns: ["survey_id"]
isOneToOne: false
      referencedRelation: "surveys"
      referencedColumns: ["id"]
    }
                  ]
                },"quote_approvals": {
                  Row: {
                    "approver_name": string,"approver_phone": string,"attempt_count": number,"created_at": string,"delivery_channel": Database["public"]['Enums']["msg_channel"],"dlt_template_id": string | null,"failed_attempts": number,"gateway_message_id": string | null,"geolocation": Json | null,"id": string,"ip_address": unknown,"otp_delivered_at": string | null,"otp_generated_at": string,"otp_hash": string,"otp_verified_at": string,"pdf_sha256": string,"quotation_id": string,"quotation_version": number,"terms_text": string,"user_agent": string | null
                  }
                  Insert: {
                    "approver_name": string,"approver_phone": string,"attempt_count"?: number,"created_at"?: string,"delivery_channel": Database["public"]['Enums']["msg_channel"],"dlt_template_id"?: string | null,"failed_attempts"?: number,"gateway_message_id"?: string | null,"geolocation"?: Json | null,"id"?: string,"ip_address"?: unknown,"otp_delivered_at"?: string | null,"otp_generated_at": string,"otp_hash": string,"otp_verified_at": string,"pdf_sha256": string,"quotation_id": string,"quotation_version": number,"terms_text": string,"user_agent"?: string | null
                  }
                  Update: {
                    "approver_name"?: string,"approver_phone"?: string,"attempt_count"?: number,"created_at"?: string,"delivery_channel"?: Database["public"]['Enums']["msg_channel"],"dlt_template_id"?: string | null,"failed_attempts"?: number,"gateway_message_id"?: string | null,"geolocation"?: Json | null,"id"?: string,"ip_address"?: unknown,"otp_delivered_at"?: string | null,"otp_generated_at"?: string,"otp_hash"?: string,"otp_verified_at"?: string,"pdf_sha256"?: string,"quotation_id"?: string,"quotation_version"?: number,"terms_text"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quote_approvals_quotation_id_fkey"
      columns: ["quotation_id"]
isOneToOne: false
      referencedRelation: "quotations"
      referencedColumns: ["id"]
    }
                  ]
                },"quote_otps": {
                  Row: {
                    "attempts": number,"channel": Database["public"]['Enums']["msg_channel"],"delivered_at": string | null,"dlt_template_id": string | null,"expires_at": string,"failed_attempts": number,"gateway_message_id": string | null,"generated_at": string,"id": string,"locked_at": string | null,"otp_hash": string,"phone": string,"quotation_id": string,"verified_at": string | null
                  }
                  Insert: {
                    "attempts"?: number,"channel": Database["public"]['Enums']["msg_channel"],"delivered_at"?: string | null,"dlt_template_id"?: string | null,"expires_at": string,"failed_attempts"?: number,"gateway_message_id"?: string | null,"generated_at"?: string,"id"?: string,"locked_at"?: string | null,"otp_hash": string,"phone": string,"quotation_id": string,"verified_at"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"channel"?: Database["public"]['Enums']["msg_channel"],"delivered_at"?: string | null,"dlt_template_id"?: string | null,"expires_at"?: string,"failed_attempts"?: number,"gateway_message_id"?: string | null,"generated_at"?: string,"id"?: string,"locked_at"?: string | null,"otp_hash"?: string,"phone"?: string,"quotation_id"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quote_otps_quotation_id_fkey"
      columns: ["quotation_id"]
isOneToOne: false
      referencedRelation: "quotations"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_card_items": {
                  Row: {
                    "finish_id": string | null,"fitting_type_id": string,"gst_rate": number,"hsn_sac": string | null,"id": string,"price": number,"rate_card_id": string,"work_type_id": string
                  }
                  Insert: {
                    "finish_id"?: string | null,"fitting_type_id": string,"gst_rate"?: number,"hsn_sac"?: string | null,"id"?: string,"price": number,"rate_card_id": string,"work_type_id": string
                  }
                  Update: {
                    "finish_id"?: string | null,"fitting_type_id"?: string,"gst_rate"?: number,"hsn_sac"?: string | null,"id"?: string,"price"?: number,"rate_card_id"?: string,"work_type_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rate_card_items_finish_id_fkey"
      columns: ["finish_id"]
isOneToOne: false
      referencedRelation: "finishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rate_card_items_fitting_type_id_fkey"
      columns: ["fitting_type_id"]
isOneToOne: false
      referencedRelation: "fitting_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rate_card_items_rate_card_id_fkey"
      columns: ["rate_card_id"]
isOneToOne: false
      referencedRelation: "rate_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rate_card_items_work_type_id_fkey"
      columns: ["work_type_id"]
isOneToOne: false
      referencedRelation: "work_types"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_cards": {
                  Row: {
                    "activated_at": string | null,"created_at": string,"created_by": string | null,"effective_from": string,"id": string,"is_active": boolean,"notes": string | null,"version": number
                  }
                  Insert: {
                    "activated_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"effective_from": string,"id"?: string,"is_active"?: boolean,"notes"?: string | null,"version": number
                  }
                  Update: {
                    "activated_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"effective_from"?: string,"id"?: string,"is_active"?: boolean,"notes"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "rate_cards_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"service_requests": {
                  Row: {
                    "ack_due_at": string,"acknowledged_at": string | null,"assigned_to": string | null,"body": string | null,"created_at": string,"customer_id": string,"id": string,"job_unit_id": string | null,"property_id": string | null,"raised_by": string | null,"request_no": string,"resolution_note": string | null,"resolve_due_at": string,"resolved_at": string | null,"status": string,"subject": string,"updated_at": string,"warranty_id": string | null
                  }
                  Insert: {
                    "ack_due_at": string,"acknowledged_at"?: string | null,"assigned_to"?: string | null,"body"?: string | null,"created_at"?: string,"customer_id": string,"id"?: string,"job_unit_id"?: string | null,"property_id"?: string | null,"raised_by"?: string | null,"request_no": string,"resolution_note"?: string | null,"resolve_due_at": string,"resolved_at"?: string | null,"status"?: string,"subject": string,"updated_at"?: string,"warranty_id"?: string | null
                  }
                  Update: {
                    "ack_due_at"?: string,"acknowledged_at"?: string | null,"assigned_to"?: string | null,"body"?: string | null,"created_at"?: string,"customer_id"?: string,"id"?: string,"job_unit_id"?: string | null,"property_id"?: string | null,"raised_by"?: string | null,"request_no"?: string,"resolution_note"?: string | null,"resolve_due_at"?: string,"resolved_at"?: string | null,"status"?: string,"subject"?: string,"updated_at"?: string,"warranty_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_requests_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_job_unit_id_fkey"
      columns: ["job_unit_id"]
isOneToOne: false
      referencedRelation: "job_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_job_unit_id_fkey"
      columns: ["job_unit_id"]
isOneToOne: false
      referencedRelation: "v_delayed_units"
      referencedColumns: ["job_unit_id"]
    },{
      foreignKeyName: "service_requests_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_warranty_id_fkey"
      columns: ["warranty_id"]
isOneToOne: false
      referencedRelation: "warranties"
      referencedColumns: ["id"]
    }
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
                },"stock_alerts": {
                  Row: {
                    "id": string,"item_id": string,"min_level": number,"notified_at": string | null,"quantity": number,"raised_at": string
                  }
                  Insert: {
                    "id"?: string,"item_id": string,"min_level": number,"notified_at"?: string | null,"quantity": number,"raised_at"?: string
                  }
                  Update: {
                    "id"?: string,"item_id"?: string,"min_level"?: number,"notified_at"?: string | null,"quantity"?: number,"raised_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_alerts_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_alerts_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_items": {
                  Row: {
                    "below_min_since": string | null,"category": string | null,"created_at": string,"id": string,"is_active": boolean,"last_alert_at": string | null,"min_level": number,"name": string,"quantity": number,"sku": string,"uom": string,"updated_at": string
                  }
                  Insert: {
                    "below_min_since"?: string | null,"category"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"last_alert_at"?: string | null,"min_level"?: number,"name": string,"quantity"?: number,"sku": string,"uom"?: string,"updated_at"?: string
                  }
                  Update: {
                    "below_min_since"?: string | null,"category"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"last_alert_at"?: string | null,"min_level"?: number,"name"?: string,"quantity"?: number,"sku"?: string,"uom"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stock_movements": {
                  Row: {
                    "actor_id": string,"id": string,"item_id": string,"job_id": string | null,"occurred_at": string,"quantity": number,"reason": string | null,"type": Database["public"]['Enums']["stock_move_type"]
                  }
                  Insert: {
                    "actor_id": string,"id"?: string,"item_id": string,"job_id"?: string | null,"occurred_at"?: string,"quantity": number,"reason"?: string | null,"type": Database["public"]['Enums']["stock_move_type"]
                  }
                  Update: {
                    "actor_id"?: string,"id"?: string,"item_id"?: string,"job_id"?: string | null,"occurred_at"?: string,"quantity"?: number,"reason"?: string | null,"type"?: Database["public"]['Enums']["stock_move_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stock_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "v_invoices_due"
      referencedColumns: ["job_id"]
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
                },"team_notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"dedup_key": string | null,"entity_id": string | null,"entity_type": string | null,"id": string,"read_at": string | null,"rule_code": string,"title": string,"user_id": string
                  }
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"dedup_key"?: string | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"read_at"?: string | null,"rule_code": string,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"dedup_key"?: string | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"read_at"?: string | null,"rule_code"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"unit_blocks": {
                  Row: {
                    "blocked_from": string,"blocked_to": string | null,"created_by": string | null,"id": string,"job_unit_id": string,"note": string | null,"reason": string
                  }
                  Insert: {
                    "blocked_from"?: string,"blocked_to"?: string | null,"created_by"?: string | null,"id"?: string,"job_unit_id": string,"note"?: string | null,"reason": string
                  }
                  Update: {
                    "blocked_from"?: string,"blocked_to"?: string | null,"created_by"?: string | null,"id"?: string,"job_unit_id"?: string,"note"?: string | null,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "unit_blocks_job_unit_id_fkey"
      columns: ["job_unit_id"]
isOneToOne: false
      referencedRelation: "job_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "unit_blocks_job_unit_id_fkey"
      columns: ["job_unit_id"]
isOneToOne: false
      referencedRelation: "v_delayed_units"
      referencedColumns: ["job_unit_id"]
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
                },"warranties": {
                  Row: {
                    "card_no": string,"created_at": string,"fitting_id": string,"id": string,"job_id": string,"job_unit_id": string,"kind": string,"terms_text": string,"valid_from": string,"valid_until": string
                  }
                  Insert: {
                    "card_no": string,"created_at"?: string,"fitting_id": string,"id"?: string,"job_id": string,"job_unit_id": string,"kind": string,"terms_text": string,"valid_from": string,"valid_until": string
                  }
                  Update: {
                    "card_no"?: string,"created_at"?: string,"fitting_id"?: string,"id"?: string,"job_id"?: string,"job_unit_id"?: string,"kind"?: string,"terms_text"?: string,"valid_from"?: string,"valid_until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "warranties_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: false
      referencedRelation: "fittings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "warranties_fitting_id_fkey"
      columns: ["fitting_id"]
isOneToOne: false
      referencedRelation: "v_incomplete_fittings"
      referencedColumns: ["fitting_id"]
    },{
      foreignKeyName: "warranties_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "warranties_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "v_invoices_due"
      referencedColumns: ["job_id"]
    },{
      foreignKeyName: "warranties_job_unit_id_fkey"
      columns: ["job_unit_id"]
isOneToOne: false
      referencedRelation: "job_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "warranties_job_unit_id_fkey"
      columns: ["job_unit_id"]
isOneToOne: false
      referencedRelation: "v_delayed_units"
      referencedColumns: ["job_unit_id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "event_type": string | null,"external_id": string,"id": string,"last_error": string | null,"payload": NonNullable<Json>,"processed_at": string | null,"received_at": string,"retry_count": number,"signature_ok": boolean,"source": Database["public"]['Enums']["webhook_source"],"status": Database["public"]['Enums']["webhook_status"]
                  }
                  Insert: {
                    "event_type"?: string | null,"external_id": string,"id"?: string,"last_error"?: string | null,"payload": NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"retry_count"?: number,"signature_ok": boolean,"source": Database["public"]['Enums']["webhook_source"],"status"?: Database["public"]['Enums']["webhook_status"]
                  }
                  Update: {
                    "event_type"?: string | null,"external_id"?: string,"id"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"retry_count"?: number,"signature_ok"?: boolean,"source"?: Database["public"]['Enums']["webhook_source"],"status"?: Database["public"]['Enums']["webhook_status"]
                  }
                  Relationships: [
                    
                  ]
                },"whatsapp_conversations": {
                  Row: {
                    "created_at": string,"ctwa_clid": string | null,"customer_id": string | null,"id": string,"last_message_at": string | null,"lead_id": string | null,"profile_name": string | null,"referral_source_id": string | null,"referral_source_type": string | null,"wa_id": string,"window_expires_at": string | null
                  }
                  Insert: {
                    "created_at"?: string,"ctwa_clid"?: string | null,"customer_id"?: string | null,"id"?: string,"last_message_at"?: string | null,"lead_id"?: string | null,"profile_name"?: string | null,"referral_source_id"?: string | null,"referral_source_type"?: string | null,"wa_id": string,"window_expires_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"ctwa_clid"?: string | null,"customer_id"?: string | null,"id"?: string,"last_message_at"?: string | null,"lead_id"?: string | null,"profile_name"?: string | null,"referral_source_id"?: string | null,"referral_source_type"?: string | null,"wa_id"?: string,"window_expires_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_conversations_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_conversations_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_messages": {
                  Row: {
                    "body": string | null,"conversation_id": string,"direction": string,"id": string,"kind": string,"media": Json | null,"occurred_at": string,"sent_by": string | null,"status": string | null,"template_code": string | null,"wamid": string | null
                  }
                  Insert: {
                    "body"?: string | null,"conversation_id": string,"direction": string,"id"?: string,"kind"?: string,"media"?: Json | null,"occurred_at"?: string,"sent_by"?: string | null,"status"?: string | null,"template_code"?: string | null,"wamid"?: string | null
                  }
                  Update: {
                    "body"?: string | null,"conversation_id"?: string,"direction"?: string,"id"?: string,"kind"?: string,"media"?: Json | null,"occurred_at"?: string,"sent_by"?: string | null,"status"?: string | null,"template_code"?: string | null,"wamid"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "whatsapp_conversations"
      referencedColumns: ["id"]
    }
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
            "v_delayed_units": {
                  Row: {
                    "effective_downtime_hours": number | null,"job_id": string | null,"job_unit_id": string | null,"planned_downtime_hours": number | null
                  }
                  Insert: {
                           "effective_downtime_hours"?: never,"job_id"?: string | null,"job_unit_id"?: string | null,"planned_downtime_hours"?: number | null
                         }
                        Update: {
                           "effective_downtime_hours"?: never,"job_id"?: string | null,"job_unit_id"?: string | null,"planned_downtime_hours"?: number | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "job_units_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_units_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "v_invoices_due"
      referencedColumns: ["job_id"]
    }
                  ]
                },"v_incomplete_fittings": {
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
                },"v_invoices_due": {
                  Row: {
                    "customer_id": string | null,"days_since_supply": number | null,"job_id": string | null,"job_no": string | null,"supply_date": string | null
                  }
                  Insert: {
                           "customer_id"?: string | null,"days_since_supply"?: never,"job_id"?: string | null,"job_no"?: string | null,"supply_date"?: string | null
                         }
                        Update: {
                           "customer_id"?: string | null,"days_since_supply"?: never,"job_id"?: string | null,"job_no"?: string | null,"supply_date"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "jobs_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"v_low_stock": {
                  Row: {
                    "below_min_since": string | null,"category": string | null,"id": string | null,"min_level": number | null,"name": string | null,"quantity": number | null,"sku": string | null,"uom": string | null
                  }
                  Insert: {
                           "below_min_since"?: string | null,"category"?: string | null,"id"?: string | null,"min_level"?: number | null,"name"?: string | null,"quantity"?: number | null,"sku"?: string | null,"uom"?: string | null
                         }
                        Update: {
                           "below_min_since"?: string | null,"category"?: string | null,"id"?: string | null,"min_level"?: number | null,"name"?: string | null,"quantity"?: number | null,"sku"?: string | null,"uom"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"v_service_requests_overdue": {
                  Row: {
                    "ack_due_at": string | null,"ack_overdue": boolean | null,"customer_id": string | null,"id": string | null,"request_no": string | null,"resolve_due_at": string | null,"resolve_overdue": boolean | null,"status": string | null
                  }
                  Insert: {
                           "ack_due_at"?: string | null,"ack_overdue"?: never,"customer_id"?: string | null,"id"?: string | null,"request_no"?: string | null,"resolve_due_at"?: string | null,"resolve_overdue"?: never,"status"?: string | null
                         }
                        Update: {
                           "ack_due_at"?: string | null,"ack_overdue"?: never,"customer_id"?: string | null,"id"?: string | null,"request_no"?: string | null,"resolve_due_at"?: string | null,"resolve_overdue"?: never,"status"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "service_requests_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "activate_rate_card":
{ Args: { "p_id": string }; Returns: undefined
                           },
"allocate_document_no":
{ Args: { "p_code": string,"p_date": string }; Returns: Json
                           },
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
"block_unit":
{ Args: { "p_note"?: string,"p_reason": string,"p_unit": string }; Returns: undefined
                           },
"book_survey":
{ Args: { "p": Json }; Returns: Json
                           },
"can_edit_quote":
{ Args: { "p_quote": string }; Returns: boolean
                           },
"can_run_job":
{ Args: { "p_job": string }; Returns: boolean
                           },
"cancel_invoice":
{ Args: { "p_invoice": string,"p_reason": string }; Returns: string
                           },
"check_integration_health":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"create_invoice_from_job":
{ Args: { "p_job": string }; Returns: string
                           },
"create_quote_from_survey":
{ Args: { "p_survey": string }; Returns: string
                           },
"create_quote_version":
{ Args: { "p_quote": string }; Returns: string
                           },
"current_role_is":
{ Args: { "target": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"custom_access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"decide_discount":
{ Args: { "p_approval": string,"p_approve": boolean,"p_note"?: string }; Returns: undefined
                           },
"distance_m":
{ Args: { "lat1": number,"lat2": number,"lng1": number,"lng2": number }; Returns: number
                           },
"enqueue_capi":
{ Args: { "p_event": string,"p_lead": string,"p_value"?: number }; Returns: undefined
                           },
"enqueue_meta_reconcile":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"ensure_prospect":
{ Args: { "p_lead_id": string,"p_property": Json }; Returns: Json
                           },
"expire_quotes":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"freeze_quote_for_issue":
{ Args: { "p_quote": string }; Returns: Json
                           },
"fy_start_of":
{ Args: { "p_date": string }; Returns: string
                           },
"ingest_lead":
{ Args: { "p_lead": Json }; Returns: Json
                           },
"install_schedules":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"is_my_survey_lead":
{ Args: { "p_lead_id": string }; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_system_caller":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"issue_invoice":
{ Args: { "p_invoice": string }; Returns: string
                           },
"link_to_pilot":
{ Args: { "p_job": string,"p_pilot": string }; Returns: undefined
                           },
"log_call":
{ Args: { "p_call": Json }; Returns: string
                           },
"mark_quote_sent":
{ Args: { "p_pdf_path": string,"p_pdf_sha256": string,"p_quote": string }; Returns: undefined
                           },
"market_price":
{ Args: { "p_finish": string,"p_fitting_type": string,"p_rate_card": string }; Returns: number
                           },
"move_unit_stage":
{ Args: { "p_note"?: string,"p_reason"?: string,"p_to": Database["public"]['Enums']["job_stage"],"p_unit": string }; Returns: undefined
                           },
"my_customer_ids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"new_rate_card_version":
{ Args: { "p_effective_from": string,"p_from"?: string,"p_notes"?: string }; Returns: string
                           },
"next_send_time":
{ Args: { "p_at": string }; Returns: string
                           },
"notify_customer":
{ Args: { "p_customer": string,"p_dedup": string,"p_entity_id": string,"p_entity_type": string,"p_lead": string,"p_rule": string,"p_to": string,"p_variables": Json }; Returns: string
                           },
"notify_team":
{ Args: { "p_body": string,"p_dedup": string,"p_entity_id": string,"p_entity_type": string,"p_rule": string,"p_title": string,"p_user"?: string }; Returns: number
                           },
"progress_service_request":
{ Args: { "p_id": string,"p_note"?: string,"p_to": string }; Returns: undefined
                           },
"raise_service_request":
{ Args: { "p": Json }; Returns: Json
                           },
"rate_card_price":
{ Args: { "p_finish": string,"p_fitting_type": string,"p_rate_card": string,"p_work_type_code": string }; Returns: number
                           },
"recompute_quote":
{ Args: { "p_quote": string }; Returns: undefined
                           },
"record_handover":
{ Args: { "p": Json }; Returns: string
                           },
"record_otp_delivery":
{ Args: { "p_dlt_template_id"?: string,"p_gateway_message_id": string,"p_otp": string }; Returns: undefined
                           },
"record_payment":
{ Args: { "p": Json }; Returns: Json
                           },
"record_stock_movement":
{ Args: { "p": Json }; Returns: number
                           },
"record_webhook":
{ Args: { "p_event_type": string,"p_external_id": string,"p_payload": Json,"p_signature_ok": boolean,"p_source": Database["public"]['Enums']["webhook_source"] }; Returns: Json
                           },
"request_quote_otp":
{ Args: { "p_channel": Database["public"]['Enums']["msg_channel"],"p_phone": string,"p_quote": string }; Returns: Json
                           },
"rollup_job":
{ Args: { "p_job": string }; Returns: undefined
                           },
"set_invoice_pdf":
{ Args: { "p_invoice": string,"p_path": string,"p_sha256": string }; Returns: undefined
                           },
"set_quote_discount":
{ Args: { "p_pct": number,"p_quote": string,"p_reason"?: string }; Returns: Database["public"]['Enums']["quote_status"]
                           },
"staff_can_see_customer":
{ Args: { "p_customer_id": string }; Returns: boolean
                           },
"submit_survey":
{ Args: { "p_survey_id": string }; Returns: undefined
                           },
"sweep_job_delays":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"sweep_sla":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"unblock_unit":
{ Args: { "p_unit": string }; Returns: undefined
                           },
"unit_effective_downtime_hours":
{ Args: { "p_unit": string }; Returns: number
                           },
"upsert_assessment":
{ Args: { "p": Json }; Returns: string
                           },
"verify_quote_otp":
{ Args: { "p"?: Json,"p_code": string,"p_otp": string }; Returns: Json
                           },
"webhook_failed":
{ Args: { "p_error": string,"p_id": string }; Returns: Database["public"]['Enums']["webhook_status"]
                           },
"webhook_processed":
{ Args: { "p_id": string }; Returns: undefined
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

