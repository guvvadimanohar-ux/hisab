import Foundation
import Vision
import ImageIO
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
let handler = VNImageRequestHandler(url: url, options: [:])
do {
 try handler.perform([request])
 let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first }.map { ["text": $0.string, "confidence": $0.confidence] as [String: Any] }
 let data = try JSONSerialization.data(withJSONObject: lines)
 print(String(data: data, encoding: .utf8)!)
} catch { fputs("Receipt could not be recognized.\n", stderr); exit(1) }
