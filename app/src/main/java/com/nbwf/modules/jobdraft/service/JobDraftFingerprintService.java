package com.nbwf.modules.jobdraft.service;

import com.nbwf.modules.jobdraft.model.PageSyncJobDraftRequest;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.StringJoiner;

@Service
public class JobDraftFingerprintService {

    public String build(String sourcePlatform, PageSyncJobDraftRequest req) {
        String platform = normalizePlatform(sourcePlatform);
        String externalJobId = trimToNull(req.externalJobId());
        if (externalJobId != null) {
            return platform + ":external:" + externalJobId;
        }

        String sourceUrl = trimToNull(req.sourceUrl());
        if (sourceUrl != null) {
            return platform + ":url:" + sourceUrl;
        }

        StringJoiner joiner = new StringJoiner("|");
        joiner.add(normalizeText(req.company()));
        joiner.add(normalizeText(req.title()));
        joiner.add(normalizeText(req.salaryTextRaw()));
        joiner.add(normalizeText(req.location()));
        return platform + ":hash:" + sha256(joiner.toString()).substring(0, 32);
    }

    private String normalizePlatform(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? "UNKNOWN" : normalized.toUpperCase(Locale.ROOT);
    }

    private String normalizeText(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? "" : normalized.toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm is not available", e);
        }
    }
}
