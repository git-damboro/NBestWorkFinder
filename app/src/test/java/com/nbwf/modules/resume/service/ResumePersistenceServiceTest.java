package com.nbwf.modules.resume.service;

import com.nbwf.infrastructure.file.FileHashService;
import com.nbwf.infrastructure.mapper.ResumeMapper;
import com.nbwf.modules.resume.model.ResumeAnalysisEntity;
import com.nbwf.modules.resume.model.ResumeEntity;
import com.nbwf.modules.resume.repository.ResumeAnalysisRepository;
import com.nbwf.modules.resume.repository.ResumeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumePersistenceServiceTest {

    @Mock
    private ResumeRepository resumeRepository;

    @Mock
    private ResumeAnalysisRepository analysisRepository;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private ResumeMapper resumeMapper;

    @Mock
    private FileHashService fileHashService;

    @InjectMocks
    private ResumePersistenceService resumePersistenceService;

    @Test
    void findExistingResumeShouldQueryWithinCurrentUserScope() {
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "resume.pdf",
            "application/pdf",
            "resume".getBytes(StandardCharsets.UTF_8)
        );
        ResumeEntity existingResume = new ResumeEntity();

        when(fileHashService.calculateHash(file)).thenReturn("hash-1");
        when(resumeRepository.findByFileHashAndUserId("hash-1", 7L)).thenReturn(Optional.of(existingResume));
        when(resumeRepository.save(existingResume)).thenReturn(existingResume);

        Optional<ResumeEntity> result = resumePersistenceService.findExistingResume(file, 7L);

        assertSame(existingResume, result.orElseThrow());
        verify(resumeRepository).findByFileHashAndUserId("hash-1", 7L);
        verify(resumeRepository).save(existingResume);
    }

    @Test
    void saveResumeShouldBindResumeToCurrentUser() {
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "resume.pdf",
            "application/pdf",
            "resume".getBytes(StandardCharsets.UTF_8)
        );

        when(fileHashService.calculateHash(file)).thenReturn("hash-2");
        when(resumeRepository.save(any(ResumeEntity.class))).thenAnswer(invocation -> {
            ResumeEntity entity = invocation.getArgument(0);
            entity.setId(11L);
            return entity;
        });

        ResumeEntity savedResume = resumePersistenceService.saveResume(
            file,
            "parsed resume",
            "storage-key",
            "storage-url",
            7L
        );

        ArgumentCaptor<ResumeEntity> captor = ArgumentCaptor.forClass(ResumeEntity.class);
        verify(resumeRepository).save(captor.capture());

        assertEquals(7L, captor.getValue().getUserId());
        assertEquals(7L, savedResume.getUserId());
        assertEquals("hash-2", savedResume.getFileHash());
    }

    @Test
    void findByIdShouldRestrictLookupToCurrentUser() {
        ResumeEntity ownedResume = new ResumeEntity();
        when(resumeRepository.findByIdAndUserId(21L, 7L)).thenReturn(Optional.of(ownedResume));

        Optional<ResumeEntity> result = resumePersistenceService.findById(21L, 7L);

        assertSame(ownedResume, result.orElseThrow());
        verify(resumeRepository).findByIdAndUserId(21L, 7L);
    }
}
