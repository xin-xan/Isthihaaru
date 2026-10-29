# Background removal models

Both run in the user's browser (onnxruntime-web, inside a Web Worker), so photos never leave the device.

| File | Model | Licence | Used for |
| --- | --- | --- | --- |
| `u2netp.onnx` | U²-Net lite by Xuebin Qin et al. (<https://github.com/xuebinqin/U-2-Net>) | Apache-2.0 | Quick pass, 320 px |
| `isnet-int8.onnx` | ISNet / DIS general-use by Xuebin Qin et al. (<https://github.com/xuebinqin/DIS>) | Apache-2.0 | Best-quality pass, 1024 px |

Sources:

- `u2netp.onnx` is the rembg export, unchanged: <https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx>
  (sha256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`).
- `isnet-int8.onnx` is the rembg export <https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx>
  (sha256 `60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a`), shrunk from 178 MB to 46 MB with
  `onnxruntime.quantization.quantize_dynamic(..., weight_type=QuantType.QUInt8)`. Its masks match the full model
  at 99.5 %+ IoU on our test photos. Result sha256 `f1b1c6f7656e532627697afc989d953be1e7ef8f55a718f3611e8c9fd50cdef7`.
