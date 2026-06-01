const isoDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const isoHoursFromNow = (hours) => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

export const createSeedData = () => ({
  version: 1,
  tickets: [
    {
      id: "TCK-1001",
      customer: "Maya Chen",
      email: "maya@northstar.dev",
      company: "Northstar Labs",
      subject: "Workspace SSO is looping after password reset",
      body:
        "I reset my password this morning and now SSO keeps sending me back to the login screen. Our finance workspace is blocked and payroll approvals are due today.",
      channel: "Email",
      status: "Open",
      priority: "High",
      category: "Authentication",
      assignee: "Avery",
      tags: ["sso", "login", "payroll"],
      createdAt: isoDaysAgo(1),
      updatedAt: isoDaysAgo(0),
      dueAt: isoHoursFromNow(3),
      messages: [
        {
          author: "Maya Chen",
          type: "customer",
          body:
            "I reset my password this morning and now SSO keeps sending me back to the login screen. Our finance workspace is blocked and payroll approvals are due today.",
          createdAt: isoDaysAgo(1)
        }
      ],
      ai: null
    },
    {
      id: "TCK-1002",
      customer: "Owen Price",
      email: "owen@fieldkit.io",
      company: "FieldKit",
      subject: "Invoice shows the wrong seat count",
      body:
        "The May invoice charged us for 42 seats, but we only have 31 active users. Can you correct the invoice before our accounting close?",
      channel: "Portal",
      status: "Waiting",
      priority: "Normal",
      category: "Billing",
      assignee: "Sam",
      tags: ["invoice", "seats"],
      createdAt: isoDaysAgo(3),
      updatedAt: isoDaysAgo(2),
      dueAt: isoHoursFromNow(18),
      messages: [
        {
          author: "Owen Price",
          type: "customer",
          body:
            "The May invoice charged us for 42 seats, but we only have 31 active users. Can you correct the invoice before our accounting close?",
          createdAt: isoDaysAgo(3)
        },
        {
          author: "Sam",
          type: "agent",
          body: "I am checking the seat audit trail and will follow up with a corrected invoice.",
          createdAt: isoDaysAgo(2)
        }
      ],
      ai: null
    },
    {
      id: "TCK-1003",
      customer: "Priya Raman",
      email: "priya@atlashealth.example",
      company: "Atlas Health",
      subject: "CSV import fails on custom date fields",
      body:
        "Our CSV upload fails when the custom discharge_date field is included. The error says invalid timestamp, but the format matches the template.",
      channel: "Chat",
      status: "Open",
      priority: "Normal",
      category: "Bug",
      assignee: "Jordan",
      tags: ["csv", "import", "date"],
      createdAt: isoDaysAgo(0),
      updatedAt: isoDaysAgo(0),
      dueAt: isoHoursFromNow(24),
      messages: [
        {
          author: "Priya Raman",
          type: "customer",
          body:
            "Our CSV upload fails when the custom discharge_date field is included. The error says invalid timestamp, but the format matches the template.",
          createdAt: isoDaysAgo(0)
        }
      ],
      ai: null
    },
    {
      id: "TCK-1004",
      customer: "Diego Alvarez",
      email: "diego@solstation.co",
      company: "Sol Station",
      subject: "Need API rate limit guidance for launch",
      body:
        "We are launching a customer portal next week. Can you confirm the rate limits for the reporting API and recommend a safe retry strategy?",
      channel: "Email",
      status: "Open",
      priority: "Low",
      category: "How-to",
      assignee: "Avery",
      tags: ["api", "rate-limit"],
      createdAt: isoDaysAgo(4),
      updatedAt: isoDaysAgo(4),
      dueAt: isoHoursFromNow(36),
      messages: [
        {
          author: "Diego Alvarez",
          type: "customer",
          body:
            "We are launching a customer portal next week. Can you confirm the rate limits for the reporting API and recommend a safe retry strategy?",
          createdAt: isoDaysAgo(4)
        }
      ],
      ai: null
    }
  ],
  articles: [
    {
      id: "KB-201",
      title: "Resolve SSO redirect loops",
      collection: "Authentication",
      tags: ["sso", "login", "cookies"],
      updatedAt: isoDaysAgo(5),
      content:
        "Clear stale IdP cookies, verify the user's primary email matches the identity provider, confirm the ACS URL, then ask the customer to retry in a private browser window. Escalate if SAML responses show audience mismatch."
    },
    {
      id: "KB-202",
      title: "Invoice seat count reconciliation",
      collection: "Billing",
      tags: ["invoice", "seats", "billing"],
      updatedAt: isoDaysAgo(12),
      content:
        "Compare active users, suspended users, and billing-period snapshots. If the invoice seat count is wrong, issue a corrected invoice and add a billing note with the audit period."
    },
    {
      id: "KB-203",
      title: "CSV import date field troubleshooting",
      collection: "Imports",
      tags: ["csv", "import", "date", "timestamp"],
      updatedAt: isoDaysAgo(2),
      content:
        "Date fields accept ISO 8601, YYYY-MM-DD, or MM/DD/YYYY when the workspace locale is US. Remove hidden spreadsheet formatting and check for blank rows, timezone suffixes, and invalid leap-day values."
    },
    {
      id: "KB-204",
      title: "Reporting API rate limits",
      collection: "API",
      tags: ["api", "rate-limit", "retry"],
      updatedAt: isoDaysAgo(9),
      content:
        "The reporting API supports 600 requests per minute per workspace. Clients should use exponential backoff with jitter, honor Retry-After headers, and cache report metadata for at least five minutes."
    }
  ],
  settings: {
    workspaceName: "Helix Support",
    defaultAssignee: "Avery",
    tone: "clear, calm, and concise",
    aiProvider: "fallback",
    ollamaEndpoint: "http://localhost:11434",
    ollamaModel: "llama3.1",
    autoIncludeKb: true
  }
});
