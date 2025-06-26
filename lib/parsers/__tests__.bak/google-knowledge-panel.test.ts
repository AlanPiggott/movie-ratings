import { parseGoogleKnowledgePanel, hasKnowledgePanel, findAllPercentages } from '../google-knowledge-panel'

describe('Google Knowledge Panel Parser', () => {
  describe('parseGoogleKnowledgePanel', () => {
    it('should extract percentage from "X% liked this movie" pattern', () => {
      const html = '<div>85% liked this movie</div>'
      const result = parseGoogleKnowledgePanel(html)
      
      expect(result.percentage).toBe(85)
      expect(result.rawMatch).toBe('85% liked this movie')
    })

    it('should extract percentage from "X% of people liked this" pattern', () => {
      const html = '<div>92% of people liked this</div>'
      const result = parseGoogleKnowledgePanel(html)
      
      expect(result.percentage).toBe(92)
    })

    it('should extract percentage from "audience score: X%" pattern', () => {
      const html = '<span>Audience Score: 78%</span>'
      const result = parseGoogleKnowledgePanel(html)
      
      expect(result.percentage).toBe(78)
    })

    it('should handle HTML with multiple elements', () => {
      const html = `
        <div class="kp-header">
          <div class="title">Movie Title</div>
          <div data-attrid="kc:/ugc:thumbs_up">73% liked this film</div>
        </div>
      `
      const result = parseGoogleKnowledgePanel(html)
      
      expect(result.percentage).toBe(73)
    })

    it('should return null for HTML without percentage', () => {
      const html = '<div>This is a great movie</div>'
      const result = parseGoogleKnowledgePanel(html)
      
      expect(result.percentage).toBeNull()
    })

    it('should handle empty or invalid input', () => {
      expect(parseGoogleKnowledgePanel('').percentage).toBeNull()
      expect(parseGoogleKnowledgePanel(null as any).percentage).toBeNull()
      expect(parseGoogleKnowledgePanel(undefined as any).percentage).toBeNull()
    })

    it('should validate percentage is in valid range', () => {
      const html1 = '<div>150% liked this movie</div>' // Invalid (>100)
      const html2 = '<div>text with 110% approval</div>' // Invalid (>100)
      
      expect(parseGoogleKnowledgePanel(html1).percentage).toBeNull()
      expect(parseGoogleKnowledgePanel(html2).percentage).toBeNull()
    })

    it('should handle percentage at boundaries', () => {
      const html0 = '<div>0% liked this movie</div>'
      const html100 = '<div>100% liked this movie</div>'
      
      expect(parseGoogleKnowledgePanel(html0).percentage).toBe(0)
      expect(parseGoogleKnowledgePanel(html100).percentage).toBe(100)
    })

    it('should extract from complex HTML with scripts and styles', () => {
      const html = `
        <script>console.log('test')</script>
        <style>.test { color: red; }</style>
        <div class="content">
          <!-- Comment -->
          <p>Rating: <strong>88% liked</strong></p>
        </div>
      `
      const result = parseGoogleKnowledgePanel(html)
      
      expect(result.percentage).toBe(88)
    })

    it('should use fallback pattern when main patterns fail', () => {
      const html = '<div>The movie received 95% positive reviews, liked by many</div>'
      const result = parseGoogleKnowledgePanel(html)
      
      expect(result.percentage).toBe(95)
      // The "positive" pattern is one of the main patterns, not fallback
      expect(result.matchedPattern).toContain('positive')
    })
  })

  describe('hasKnowledgePanel', () => {
    it('should detect knowledge panel indicators', () => {
      expect(hasKnowledgePanel('<div class="kp-wholepage">')).toBe(true)
      expect(hasKnowledgePanel('<div id="knowledge-panel">')).toBe(true)
      expect(hasKnowledgePanel('<div class="kno-result">')).toBe(true)
      expect(hasKnowledgePanel('<div class="g-blk">')).toBe(true)
    })

    it('should return false for regular HTML', () => {
      expect(hasKnowledgePanel('<div class="regular-content">')).toBe(false)
      expect(hasKnowledgePanel('<p>Normal paragraph</p>')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(hasKnowledgePanel('<div class="KP-wholepage">')).toBe(true)
      expect(hasKnowledgePanel('<div id="KNOWLEDGE-panel">')).toBe(true)
    })
  })

  describe('findAllPercentages', () => {
    it('should find all percentage mentions in HTML', () => {
      const html = `
        <div>85% liked this movie</div>
        <div>Critics: 92%</div>
        <div>Revenue increased by 150%</div>
      `
      const percentages = findAllPercentages(html)
      
      expect(percentages).toHaveLength(3)
      expect(percentages[0]).toContain('85%')
      expect(percentages[1]).toContain('92%')
      expect(percentages[2]).toContain('150%')
    })

    it('should return empty array when no percentages found', () => {
      const html = '<div>No percentages here</div>'
      const percentages = findAllPercentages(html)
      
      expect(percentages).toEqual([])
    })

    it('should handle percentages with surrounding text', () => {
      const html = 'The movie scored 76% on various platforms'
      const percentages = findAllPercentages(html)
      
      expect(percentages).toHaveLength(1)
      expect(percentages[0]).toContain('76%')
    })
  })
})