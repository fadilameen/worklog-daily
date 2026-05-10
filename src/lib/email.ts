interface TimesheetEntry {
  projectName: string
  taskName: string
  hours: number
  description: string
  status?: string
}

const STATUS_BG: Record<string, string> = {
  'Completed': 'rgb(106,168,79)',
  'Ongoing': 'rgb(255,217,102)',
  'On-Hold': 'rgb(224,102,102)',
  'On-Queue': 'rgb(109,158,235)',
}

const STATUS_ORDER: Record<string, number> = {
  'Completed': 0,
  'On-Hold': 1,
  'On-Queue': 2,
  'Ongoing': 3,
}

const TH = 'border-width:1px;border-style:solid;border-color:rgb(204,204,204) rgb(0,0,0) rgb(0,0,0) rgb(204,204,204);overflow:hidden;padding:2px 3px;vertical-align:middle;background-color:rgb(183,183,183);font-weight:bold;text-align:center'
const TH_FIRST = 'border-width:1px;border-style:solid;border-color:rgb(204,204,204) rgb(0,0,0) rgb(0,0,0);overflow:hidden;padding:2px 3px;vertical-align:middle;background-color:rgb(183,183,183);font-weight:bold;text-align:center'
const TD = 'border-width:1px;border-style:solid;border-color:rgb(204,204,204) rgb(0,0,0) rgb(0,0,0) rgb(204,204,204);overflow:hidden;padding:2px 3px;vertical-align:middle;text-align:center'
const TD_FIRST = 'border-width:1px;border-style:solid;border-color:rgb(204,204,204) rgb(0,0,0) rgb(0,0,0);overflow:hidden;padding:2px 3px;vertical-align:middle;text-align:center'

function formatEmailDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${d} ${months[m - 1]} ${y}`
}

export function buildEmailHtml(params: {
  userName: string
  userEmail: string
  date: string
  entries: TimesheetEntry[]
  signature?: string
}) {
  const { userName, userEmail, date, entries, signature } = params
  const formattedDate = formatEmailDate(date)

  // Sort: Completed first, Ongoing last
  const sorted = [...entries].sort((a, b) => {
    const sa = STATUS_ORDER[a.status || ''] ?? 99
    const sb = STATUS_ORDER[b.status || ''] ?? 99
    return sa - sb
  })

  const rows = sorted
    .map((e, i) => {
      const bg = e.status ? STATUS_BG[e.status] : ''
      const statusTd = bg ? `${TD};background-color:${bg}` : TD
      return `
        <tr style="height:21px">
          <td style="${TD_FIRST}">${i + 1}</td>
          <td style="${TD}">${e.projectName}</td>
          <td style="${TD}">${e.taskName}</td>
          <td style="${statusTd}">${e.status || ''}</td>
          <td style="${TD}">${e.description}</td>
          <td style="${TD}">${e.hours}</td>
        </tr>`
    })
    .join('')

  return `<div dir="ltr">
  <div>
    <span style="font-family:Arial;font-size:13.3333px">Hi Team,</span><br style="font-family:Arial;font-size:13.3333px">
    <span style="font-family:Arial;font-size:13.3333px">Please go through my daily work report,</span>
  </div>
  <div>
    <table cellspacing="0" cellpadding="0" dir="ltr" border="1" style="table-layout:fixed;font-size:10pt;font-family:Arial;border-collapse:collapse;border-width:medium;border-style:none;border-color:currentcolor">
      <colgroup>
        <col width="43">
        <col width="112">
        <col width="161">
        <col width="107">
        <col width="327">
        <col width="95">
      </colgroup>
      <tbody>
        <tr style="height:21px">
          <td style="border:1px solid rgb(0,0,0);overflow:hidden;padding:2px 3px;vertical-align:middle;background-color:rgb(153,153,153);font-weight:bold;text-align:center" colspan="6">Work Report_${formattedDate}</td>
        </tr>
        <tr style="height:21px">
          <td style="${TH_FIRST}">Sl No</td>
          <td style="${TH}">Project</td>
          <td style="${TH}">Task</td>
          <td style="${TH}">Status</td>
          <td style="${TH}">Remarks</td>
          <td style="${TH}">Hours Spent</td>
        </tr>
        ${rows}
      </tbody>
    </table>
  </div>
  ${signature?.trim()
    ? `<div dir="ltr"><br><br>${signature}</div>`
    : `<div dir="ltr">
    <p style="color:rgb(34,34,34);font-family:verdana,sans-serif;line-height:1.656;margin-top:0;margin-bottom:0">
      <span style="font-size:10pt;font-family:Verdana;color:rgb(0,0,0)"><br><br><br>Thanks &amp; Regards</span>
    </p>
    <p style="color:rgb(34,34,34);font-family:verdana,sans-serif;line-height:1.656;margin-top:0;margin-bottom:0"><br></p>
    <table style="border:none;border-collapse:collapse">
      <tbody>
        <tr>
          <td style="border-bottom:0.75pt solid rgb(183,183,183);border-top:0.75pt solid rgb(183,183,183);vertical-align:bottom;padding:2pt">
            <p style="line-height:1.656;margin-top:0;margin-bottom:0"><font color="#875a7b" face="Verdana"><b>${userName}</b></font></p>
            <p style="line-height:1.656;margin-top:0;margin-bottom:0"><font face="Verdana" color="#666666">${userEmail}</font></p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>`}
</div>`
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to refresh access token')
  return data.access_token
}

export async function sendWorkReport(params: {
  accessToken: string
  refreshToken?: string | null
  userEmail: string
  userName: string
  recipients: string[]
  cc?: string[]
  bcc?: string[]
  date: string
  entries: TimesheetEntry[]
  signature?: string
}) {
  const { userEmail, userName, recipients, cc = [], bcc = [], date, entries, signature } = params
  let { accessToken } = params

  const formattedDate = formatEmailDate(date)
  const html = buildEmailHtml({ userName, userEmail, date, entries, signature })
  const subject = `Daily Work Report_${formattedDate}_${userName.toUpperCase()}`

  const headers: string[] = [
    `From: "${userName}" <${userEmail}>`,
    `To: ${recipients.join(', ')}`,
  ]
  if (cc.length) headers.push(`Cc: ${cc.join(', ')}`)
  if (bcc.length) headers.push(`Bcc: ${bcc.join(', ')}`)
  headers.push(`Subject: ${subject}`, `Content-Type: text/html; charset=utf-8`, `MIME-Version: 1.0`, ``)

  const message = [...headers, html].join('\r\n')
  const raw = Buffer.from(message).toString('base64url')

  async function trySend(token: string) {
    return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })
  }

  let res = await trySend(accessToken)

  if (res.status === 401 && params.refreshToken) {
    accessToken = await refreshAccessToken(params.refreshToken)
    res = await trySend(accessToken)
  }

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message || `Gmail API error ${res.status}`)
  }
}
