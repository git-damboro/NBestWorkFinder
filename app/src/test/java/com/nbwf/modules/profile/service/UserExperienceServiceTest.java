package com.nbwf.modules.profile.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.modules.profile.model.CreateUserExperienceRequest;
import com.nbwf.modules.profile.model.UpdateUserExperienceRequest;
import com.nbwf.modules.profile.model.UserExperienceEntity;
import com.nbwf.modules.profile.model.UserExperienceType;
import com.nbwf.modules.profile.repository.UserExperienceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserExperienceServiceTest {

    @Mock
    private UserExperienceRepository repository;

    @InjectMocks
    private UserExperienceService service;

    @Test
    void createShouldTrimContentAndBindCurrentUser() {
        when(repository.save(any(UserExperienceEntity.class))).thenAnswer(invocation -> {
            UserExperienceEntity entity = invocation.getArgument(0);
            entity.setId(101L);
            entity.setCreatedAt(LocalDateTime.of(2026, 4, 26, 10, 0));
            entity.setUpdatedAt(LocalDateTime.of(2026, 4, 26, 10, 0));
            return entity;
        });

        var actual = service.create(new CreateUserExperienceRequest(
            UserExperienceType.PROJECT,
            "  智能简历分析平台  ",
            "  负责后端服务和 AI 生成链路  ",
            List.of("Java", "AI"),
            true
        ), 7L);

        ArgumentCaptor<UserExperienceEntity> captor = ArgumentCaptor.forClass(UserExperienceEntity.class);
        verify(repository).save(captor.capture());
        assertEquals(7L, captor.getValue().getUserId());
        assertEquals("智能简历分析平台", captor.getValue().getTitle());
        assertEquals("负责后端服务和 AI 生成链路", captor.getValue().getContent());
        assertEquals("Java,AI", captor.getValue().getTags());
        assertEquals(101L, actual.id());
    }

    @Test
    void listShouldOnlyReturnCurrentUsersExperiences() {
        UserExperienceEntity entity = buildExperience(101L, 7L);
        when(repository.findByUserIdOrderByEnabledDescUpdatedAtDesc(7L)).thenReturn(List.of(entity));

        var actual = service.list(7L);

        verify(repository).findByUserIdOrderByEnabledDescUpdatedAtDesc(7L);
        assertEquals(1, actual.size());
        assertEquals("项目经历", actual.get(0).title());
    }

    @Test
    void updateShouldRejectOtherUsersExperience() {
        when(repository.findByIdAndUserId(101L, 8L)).thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> service.update(101L, new UpdateUserExperienceRequest(
            UserExperienceType.SKILL,
            "技能亮点",
            "熟悉 Spring Boot",
            List.of("Java"),
            true
        ), 8L));
    }

    @Test
    void updateShouldReplaceEditableFields() {
        UserExperienceEntity entity = buildExperience(101L, 7L);
        when(repository.findByIdAndUserId(101L, 7L)).thenReturn(Optional.of(entity));
        when(repository.save(any(UserExperienceEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var actual = service.update(101L, new UpdateUserExperienceRequest(
            UserExperienceType.SKILL,
            "  后端能力  ",
            "  熟悉 Java、Spring Boot 和 PostgreSQL  ",
            List.of("Java", "Spring"),
            false
        ), 7L);

        assertEquals(UserExperienceType.SKILL, entity.getType());
        assertEquals("后端能力", entity.getTitle());
        assertEquals("熟悉 Java、Spring Boot 和 PostgreSQL", entity.getContent());
        assertEquals("Java,Spring", entity.getTags());
        assertEquals(false, entity.getEnabled());
        assertEquals("后端能力", actual.title());
    }

    private static UserExperienceEntity buildExperience(Long id, Long userId) {
        UserExperienceEntity entity = new UserExperienceEntity();
        entity.setId(id);
        entity.setUserId(userId);
        entity.setType(UserExperienceType.PROJECT);
        entity.setTitle("项目经历");
        entity.setContent("负责项目核心后端开发");
        entity.setTags("Java,AI");
        entity.setEnabled(true);
        entity.setCreatedAt(LocalDateTime.of(2026, 4, 26, 10, 0));
        entity.setUpdatedAt(LocalDateTime.of(2026, 4, 26, 10, 0));
        return entity;
    }
}
