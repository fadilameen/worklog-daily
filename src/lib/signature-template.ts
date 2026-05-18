import type { UserSettings } from '@prisma/client'

export interface SignatureFields {
  name: string
  designation: string
  department: string
  company: string
  email: string
  phone: string
  whatsapp: string
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function extractSignatureFields(settings: UserSettings | null): Partial<SignatureFields> {
  return {
    name: settings?.signatureName || undefined,
    designation: settings?.signatureDesignation || undefined,
    department: settings?.signatureDepartment || undefined,
    company: settings?.signatureCompany || undefined,
    email: settings?.signatureEmail || undefined,
    phone: settings?.signaturePhone || undefined,
    whatsapp: settings?.signatureWhatsapp || undefined,
  }
}

export const DEFAULT_SIGNATURE_TEMPLATE = `<div dir="ltr"><p dir="ltr" style="color:rgb(34,34,34);font-family:verdana,sans-serif;line-height:1.656;margin-top:0pt;margin-bottom:0pt"><span style="font-size:10pt;font-family:Verdana;color:rgb(0,0,0);background-color:transparent;vertical-align:baseline"><br><br><br><br>Thanks &amp; Regards</span></p><p dir="ltr" style="color:rgb(34,34,34);font-family:verdana,sans-serif;line-height:1.656;margin-top:0pt;margin-bottom:0pt"><span style="font-size:10pt;font-family:Verdana;color:rgb(0,0,0);background-color:transparent;vertical-align:baseline"><br></span></p><div dir="ltr" align="left" style="color:rgb(34,34,34);font-family:verdana,sans-serif;margin-left:0pt"><table style="border:none;border-collapse:collapse"><colgroup><col width="180"><col width="143"><col width="74"><col width="148"></colgroup><tbody><tr style="height:0pt"><td style="border-bottom:0.75pt solid rgb(183,183,183);border-top:0.75pt solid rgb(183,183,183);vertical-align:bottom;padding:2pt;overflow:hidden"><p dir="ltr" style="line-height:1.656;margin-top:0pt;margin-bottom:0pt"><font color="#875a7b" face="Verdana"><span style="font-size:13.3333px"><b>{{name}}</b></span></font></p><p dir="ltr" style="line-height:1.656;margin-top:0pt;margin-bottom:0pt"><font face="Verdana" color="#666666"><span style="font-size:13.3333px">{{designation}}</span></font></p><p dir="ltr" style="line-height:1.656;margin-top:0pt;margin-bottom:0pt"><span style="font-size:10pt;font-family:Verdana;color:rgb(102,102,102);background-color:transparent;vertical-align:baseline">{{department}}</span></p><p dir="ltr" style="line-height:1.656;margin-top:0pt;margin-bottom:0pt"><span style="font-size:10pt;font-family:Verdana;color:rgb(102,102,102);background-color:transparent;vertical-align:baseline">{{company}}</span></p></td><td style="border-bottom:0.75pt solid rgb(183,183,183);border-top:0.75pt solid rgb(183,183,183);vertical-align:bottom;padding:2pt;overflow:hidden"><br></td><td style="border-bottom:1pt solid rgb(183,183,183);border-top:1pt solid rgb(183,183,183);vertical-align:top;padding:5pt;overflow:hidden"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt"><span style="font-size:9pt;font-family:Verdana;color:rgb(102,102,102);background-color:transparent;vertical-align:baseline">Mail</span></p><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt"><span style="font-size:9pt;font-family:Verdana;color:rgb(102,102,102);background-color:transparent;vertical-align:baseline">Mobile</span></p><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt"><span style="font-size:9pt;font-family:Verdana;color:rgb(102,102,102);background-color:transparent;vertical-align:baseline">WhatsApp</span></p></td><td style="border-bottom:1pt solid rgb(183,183,183);border-top:1pt solid rgb(183,183,183);vertical-align:top;padding:5pt;overflow:hidden"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt"><span style="font-size:9pt;font-family:Verdana;color:rgb(102,102,102);background-color:transparent;vertical-align:baseline"><a href="mailto:{{email}}" style="color:rgb(17,85,204)" target="_blank">{{email}}</a></span></p><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt"><span style="font-size:9pt;font-family:Verdana;color:rgb(102,102,102);background-color:transparent;vertical-align:baseline">{{phone}}</span></p><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt"><span style="font-size:9pt;font-family:Verdana;color:rgb(102,102,102);background-color:transparent;vertical-align:baseline">{{whatsapp}}</span></p></td></tr></tbody></table></div></div>`

export const SIGNATURE_PLACEHOLDERS = {
  name: 'John Doe',
  designation: 'Python Developer',
  department: 'Project & IT Department',
  company: 'Cybrosys Technologies',
  email: 'john@example.com',
  phone: '+91 98765 43210',
  whatsapp: '+91 98765 43210',
} as const

export function renderSignature(fields: Partial<SignatureFields> = {}): string {
  const resolved: Record<string, string> = {
    name: escapeHtml(fields.name || ''),
    designation: escapeHtml(fields.designation || ''),
    department: escapeHtml(fields.department || ''),
    company: escapeHtml(fields.company || ''),
    email: escapeHtml(fields.email || ''),
    phone: escapeHtml(fields.phone || ''),
    whatsapp: escapeHtml(fields.whatsapp || ''),
  }
  return DEFAULT_SIGNATURE_TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_, key) => resolved[key] ?? '')
}
