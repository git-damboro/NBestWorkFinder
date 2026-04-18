package com.nbwf.modules.resume.service;

import com.nbwf.common.config.AppConfigProperties;
import com.nbwf.modules.resume.listener.AnalyzeStreamProducer;
import com.nbwf.modules.resume.model.ResumeEntity;
import com.nbwf.modules.resume.repository.ResumeRepository;
import com.nbwf.infrastructure.file.FileStorageService;
import com.nbwf.infrastructure.file.FileValidationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeUploadServiceTest {

    @Mock
    private ResumeParseService parseService;

    @Mock
    private FileStorageService storageService;

    @Mock
    private ResumePersistenceService persistenceService;

    @Mock
    private AppConfigProperties appConfig;

    @Mock
    private FileValidationService fileValidationService;

    @Mock
    private AnalyzeStreamProducer analyzeStreamProducer;

    @Mock
    private ResumeRepository resumeRepository;

    @InjectMocks
    private ResumeUploadService resumeUploadService;

    @Test
    void uploadAndAnalyzeShouldPassCurrentUserIntoPersistenceFlow() {
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "resume.pdf",
            "application/pdf",
            "resume".getBytes(StandardCharsets.UTF_8)
        );
        ResumeEntity savedResume = new ResumeEntity();
        savedResume.setId(15L);
        savedResume.setOriginalFilename("resume.pdf");

        when(appConfig.getAllowedTypes()).thenReturn(List.of("application/pdf"));
        when(parseService.detectContentType(file)).thenReturn("application/pdf");
        when(persistenceService.findExistingResume(file, 7L)).thenReturn(Optional.empty());
        when(parseService.parseResume(file)).thenReturn("parsed resume");
        when(storageService.uploadResume(file)).thenReturn("storage-key");
        when(storageService.getFileUrl("storage-key")).thenReturn("storage-url");
        when(persistenceService.saveResume(file, "parsed resume", "storage-key", "storage-url", 7L))
            .thenReturn(savedResume);

        Map<String, Object> result = resumeUploadService.uploadAndAnalyze(file, 7L);

        verify(persistenceService).findExistingResume(file, 7L);
        verify(persistenceService).saveResume(file, "parsed resume", "storage-key", "storage-url", 7L);
        verify(analyzeStreamProducer).sendAnalyzeTask(15L, "parsed resume");
        assertFalse((Boolean) result.get("duplicate"));
        assertEquals(15L, ((Map<?, ?>) result.get("storage")).get("resumeId"));
    }

    @Test
    void reanalyzeShouldLoadResumeWithinCurrentUserScope() {
        ResumeEntity resume = new ResumeEntity();
        resume.setId(15L);
        resume.setOriginalFilename("resume.pdf");
        resume.setResumeText("parsed resume");

        when(persistenceService.findById(15L, 7L)).thenReturn(Optional.of(resume));
        when(resumeRepository.save(resume)).thenReturn(resume);

        resumeUploadService.reanalyze(15L, 7L);

        verify(persistenceService).findById(15L, 7L);
        verify(resumeRepository).save(resume);
        verify(analyzeStreamProducer).sendAnalyzeTask(15L, "parsed resume");
    }
}
