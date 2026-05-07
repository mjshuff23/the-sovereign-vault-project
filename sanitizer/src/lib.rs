use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ScrubRequest {
    pub request_id: String,
    pub text: String,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ScrubDecision {
    Clean,
    Blocked,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct PiiFinding {
    pub kind: String,
    pub start: usize,
    pub end: usize,
    pub replacement: String,
    pub reason: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ScrubResponse {
    pub request_id: String,
    pub sanitized_text: String,
    pub findings: Vec<PiiFinding>,
    pub decision: ScrubDecision,
    pub latency_us: u128,
}

#[derive(Debug, Clone)]
struct Pattern {
    kind: &'static str,
    regex: Regex,
    reason: &'static str,
}

static PATTERNS: Lazy<Vec<Pattern>> = Lazy::new(|| {
    vec![
        Pattern {
            kind: "ssn",
            regex: Regex::new(r"\b\d{3}-\d{2}-\d{4}\b").expect("valid ssn regex"),
            reason: "SSN-like direct identifier cannot cross the border guard",
        },
        Pattern {
            kind: "email",
            regex: Regex::new(r"(?i)\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b")
                .expect("valid email regex"),
            reason: "Email address is protected contact information",
        },
        Pattern {
            kind: "phone",
            regex: Regex::new(r"\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b")
                .expect("valid phone regex"),
            reason: "Phone number is protected contact information",
        },
        Pattern {
            kind: "name",
            regex: Regex::new(r"\b(?:Patient|Name|Member):\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b")
                .expect("valid demo name regex"),
            reason: "Demo full-name marker must be redacted before audit",
        },
    ]
});

pub fn warm_up_patterns() {
    Lazy::force(&PATTERNS);
}

pub fn scrub_text(request: &ScrubRequest) -> ScrubResponse {
    let started = Instant::now();
    let mut candidates = Vec::new();

    for pattern in PATTERNS.iter() {
        for found in pattern.regex.find_iter(&request.text) {
            candidates.push(PiiFinding {
                kind: pattern.kind.to_string(),
                start: found.start(),
                end: found.end(),
                replacement: format!("[REDACTED:{}]", pattern.kind.to_uppercase()),
                reason: pattern.reason.to_string(),
            });
        }
    }

    candidates.sort_by_key(|finding| (finding.start, finding.end));

    let findings = candidates.clone();

    let mut cursor = 0;
    let mut sanitized = String::with_capacity(request.text.len());
    for candidate in &candidates {
        if candidate.start < cursor {
            continue;
        }
        sanitized.push_str(&request.text[cursor..candidate.start]);
        sanitized.push_str(&candidate.replacement);
        cursor = candidate.end;
    }
    sanitized.push_str(&request.text[cursor..]);

    let decision = if findings.is_empty() {
        ScrubDecision::Clean
    } else {
        ScrubDecision::Blocked
    };

    ScrubResponse {
        request_id: request.request_id.clone(),
        sanitized_text: sanitized,
        findings,
        decision,
        latency_us: started.elapsed().as_micros(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_and_redacts_direct_identifiers() {
        let response = scrub_text(&ScrubRequest {
            request_id: "req-1".to_string(),
            text: "Patient: Jane Doe SSN 123-45-6789 email jane@example.com phone 212-555-0199"
                .to_string(),
        });

        assert_eq!(response.decision, ScrubDecision::Blocked);
        assert_eq!(response.findings.len(), 4);
        assert!(response.sanitized_text.contains("[REDACTED:SSN]"));
        assert!(response.sanitized_text.contains("[REDACTED:EMAIL]"));
        assert!(response.sanitized_text.contains("[REDACTED:PHONE]"));
        assert!(response.sanitized_text.contains("[REDACTED:NAME]"));
        assert!(!response.sanitized_text.contains("123-45-6789"));
    }

    #[test]
    fn allows_clean_text() {
        let response = scrub_text(&ScrubRequest {
            request_id: "req-2".to_string(),
            text: "Can this policy answer recommend contacting a clinician?".to_string(),
        });

        assert_eq!(response.decision, ScrubDecision::Clean);
        assert!(response.findings.is_empty());
        assert_eq!(
            response.sanitized_text,
            "Can this policy answer recommend contacting a clinician?"
        );
    }

    #[test]
    fn keeps_small_payload_under_latency_budget() {
        warm_up_patterns();
        let response = scrub_text(&ScrubRequest {
            request_id: "req-3".to_string(),
            text: "No direct identifier here; just a short policy question.".to_string(),
        });

        assert!(
            response.latency_us < 2_000,
            "expected <2ms, observed {}us",
            response.latency_us
        );
    }
}
