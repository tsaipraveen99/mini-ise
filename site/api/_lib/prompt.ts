// Generated from fixtures/draft-system-prompt.txt, fixtures/draft-existing-policies.txt and
// fixtures/draft-schema.json. The Python and site tests both fail if this drifts from the console.

export const SYSTEM_PROMPT = "You convert an administrator's plain-English network access rule into one structured policy for Mini ISE, a zero-trust access control service.\n\nHow evaluation works: a policy matches an access request when ALL of its conditions are true. Enabled policies are checked in ascending priority order and the first match decides. If nothing matches, access is denied.\n\nAttributes and the operators each one accepts:\n- role (eq, neq, in, not_in): employee, contractor, guest, admin\n- resource (eq, neq, in, not_in): email, wiki, engineering, finance, hr\n- location (eq, neq, in, not_in): office, remote\n- device_managed, device_encrypted, device_patched (eq, neq): true or false\n- hour (eq, neq, gte, lt): integer 0 to 23 on a 24-hour clock\n\nUse eq and neq with a single string, and in and not_in with a list of strings.\n\nEvery policy needs between 1 and 10 conditions. A rule that would apply to every request, such as \"allow everything\" or \"block everything\", cannot be a policy: set feasible to false and explain that a policy with no conditions would override every other policy and the default deny that zero trust depends on.\n\nPick a priority that places the new policy correctly among the existing ones: a restriction (deny or quarantine) must have a lower number than any allow policy it should override. Priorities must be between 1 and 1000.\n\nThe reason is shown to the user who was affected, so keep it short and plain.\n\nIf the rule cannot be expressed as a single policy with these attributes (for example it names a specific person, needs an attribute that does not exist, or needs more than one policy), set feasible to false, set policy to null, and say in explanation what is missing. Otherwise set feasible to true and describe in one sentence what the policy does.\n\nAlways set interpretation to one plain sentence starting with \"You want\" that restates what the administrator asked for in everyday words, even when the rule is not feasible.\n\nWhen feasible is false, set suggestions to 2 or 3 rules the administrator could type instead. Keep them as close as possible to what they asked for, make sure each one can be expressed as a single policy with the attributes above, and write each as a short plain-English instruction of at most 12 words, like \"Contractors cannot reach finance after 6pm\". When feasible is true, set suggestions to an empty list."

export const EXISTING_POLICIES = "- priority 10: Quarantine unencrypted devices -> quarantine\n- priority 20: Unpatched devices stay out of sensitive systems -> deny\n- priority 30: Guests may use the wiki -> allow\n- priority 35: Guests blocked elsewhere -> deny\n- priority 40: Contractors blocked from finance and HR -> deny\n- priority 50: Contractors on managed devices -> allow\n- priority 60: Employees and admins -> allow"

export const DRAFT_SCHEMA: Record<string, unknown> = {
  "type": "object",
  "properties": {
    "feasible": {
      "type": "boolean"
    },
    "explanation": {
      "type": "string"
    },
    "interpretation": {
      "type": "string"
    },
    "suggestions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "policy": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "priority": {
              "type": "integer"
            },
            "effect": {
              "type": "string",
              "enum": [
                "allow",
                "deny",
                "quarantine"
              ]
            },
            "reason": {
              "type": "string"
            },
            "conditions": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "attribute": {
                    "type": "string",
                    "enum": [
                      "role",
                      "resource",
                      "location",
                      "device_managed",
                      "device_encrypted",
                      "device_patched",
                      "hour"
                    ]
                  },
                  "op": {
                    "type": "string",
                    "enum": [
                      "eq",
                      "neq",
                      "in",
                      "not_in",
                      "gte",
                      "lt"
                    ]
                  },
                  "value": {
                    "anyOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "integer"
                      },
                      {
                        "type": "boolean"
                      },
                      {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      }
                    ]
                  }
                },
                "required": [
                  "attribute",
                  "op",
                  "value"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "name",
            "description",
            "priority",
            "effect",
            "reason",
            "conditions"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "feasible",
    "explanation",
    "interpretation",
    "suggestions",
    "policy"
  ],
  "additionalProperties": false
}
