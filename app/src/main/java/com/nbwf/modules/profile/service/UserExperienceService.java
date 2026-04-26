package com.nbwf.modules.profile.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.profile.model.CreateUserExperienceRequest;
import com.nbwf.modules.profile.model.UpdateUserExperienceRequest;
import com.nbwf.modules.profile.model.UserExperienceDTO;
import com.nbwf.modules.profile.model.UserExperienceEntity;
import com.nbwf.modules.profile.repository.UserExperienceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class UserExperienceService {

    private final UserExperienceRepository repository;

    @Transactional(readOnly = true)
    public List<UserExperienceDTO> list(Long userId) {
        return repository.findByUserIdOrderByEnabledDescUpdatedAtDesc(userId)
            .stream()
            .map(this::toDTO)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<UserExperienceDTO> listEnabled(Long userId) {
        return repository.findByUserIdAndEnabledTrueOrderByUpdatedAtDesc(userId)
            .stream()
            .map(this::toDTO)
            .toList();
    }

    @Transactional
    public UserExperienceDTO create(CreateUserExperienceRequest req, Long userId) {
        UserExperienceEntity entity = new UserExperienceEntity();
        entity.setUserId(userId);
        entity.setType(req.type());
        entity.setTitle(requireText(req.title(), "经历标题不能为空"));
        entity.setContent(requireText(req.content(), "经历内容不能为空"));
        entity.setTags(normalizeTags(req.tags()));
        entity.setEnabled(req.enabled() == null || req.enabled());
        return toDTO(repository.save(entity));
    }

    @Transactional
    public UserExperienceDTO update(Long id, UpdateUserExperienceRequest req, Long userId) {
        UserExperienceEntity entity = findByIdAndUserId(id, userId);
        entity.setType(req.type());
        entity.setTitle(requireText(req.title(), "经历标题不能为空"));
        entity.setContent(requireText(req.content(), "经历内容不能为空"));
        entity.setTags(normalizeTags(req.tags()));
        entity.setEnabled(req.enabled() == null || req.enabled());
        return toDTO(repository.save(entity));
    }

    @Transactional
    public void delete(Long id, Long userId) {
        repository.delete(findByIdAndUserId(id, userId));
    }

    private UserExperienceEntity findByIdAndUserId(Long id, Long userId) {
        return repository.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "我的经历不存在"));
    }

    private UserExperienceDTO toDTO(UserExperienceEntity entity) {
        return new UserExperienceDTO(
            entity.getId(),
            entity.getType(),
            entity.getTitle(),
            entity.getContent(),
            splitTags(entity.getTags()),
            entity.getEnabled(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    private String requireText(String value, String message) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, message);
        }
        return trimmed;
    }

    private String normalizeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return null;
        }
        String normalized = tags.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(tag -> !tag.isEmpty())
            .distinct()
            .limit(20)
            .reduce((left, right) -> left + "," + right)
            .orElse(null);
        return normalized == null || normalized.length() <= 500
            ? normalized
            : normalized.substring(0, 500);
    }

    private List<String> splitTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        return Arrays.stream(tags.split(","))
            .map(String::trim)
            .filter(tag -> !tag.isEmpty())
            .toList();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
